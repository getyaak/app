use crate::error::Error::GenericError;
use crate::error::Result;
use crate::manager::WebsocketManager;
use crate::render::render_request;
use std::str::FromStr;
use tauri::http::{HeaderMap, HeaderName};
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;
use yaak_models::models::{HttpResponseHeader, WebsocketConnection, WebsocketConnectionState, WebsocketEvent, WebsocketEventType, WebsocketMessageType, WebsocketRequest};
use yaak_models::queries;
use yaak_models::queries::{get_base_environment, get_cookie_jar, get_environment, get_websocket_connection, get_websocket_request, upsert_websocket_connection, upsert_websocket_event, UpdateSource};
use yaak_plugins::events::{
    CallHttpAuthenticationRequest, HttpHeader, RenderPurpose, WindowContext,
};
use yaak_plugins::manager::PluginManager;
use yaak_plugins::template_callback::PluginTemplateCallback;

#[tauri::command]
pub(crate) async fn upsert_request<R: Runtime>(
    request: WebsocketRequest,
    w: WebviewWindow<R>,
) -> Result<WebsocketRequest> {
    Ok(queries::upsert_websocket_request(&w, request, &UpdateSource::Window).await?)
}

#[tauri::command]
pub(crate) async fn delete_request<R: Runtime>(
    request_id: &str,
    w: WebviewWindow<R>,
) -> Result<WebsocketRequest> {
    Ok(queries::delete_websocket_request(&w, request_id, &UpdateSource::Window).await?)
}

#[tauri::command]
pub(crate) async fn list_events<R: Runtime>(
    connection_id: &str,
    app_handle: AppHandle<R>,
) -> Result<Vec<WebsocketEvent>> {
    Ok(queries::list_websocket_events(&app_handle, connection_id).await?)
}

#[tauri::command]
pub(crate) async fn list_requests<R: Runtime>(
    workspace_id: &str,
    app_handle: AppHandle<R>,
) -> Result<Vec<WebsocketRequest>> {
    Ok(queries::list_websocket_requests(&app_handle, workspace_id).await?)
}

#[tauri::command]
pub(crate) async fn list_connections<R: Runtime>(
    workspace_id: &str,
    app_handle: AppHandle<R>,
) -> Result<Vec<WebsocketConnection>> {
    Ok(queries::list_websocket_connections_for_workspace(&app_handle, workspace_id).await?)
}

#[tauri::command]
pub(crate) async fn send<R: Runtime>(
    connection_id: &str,
    window: WebviewWindow<R>,
    ws_manager: State<'_, Mutex<WebsocketManager>>,
) -> Result<WebsocketConnection> {
    let connection = get_websocket_connection(&window, connection_id).await?;
    let request = get_websocket_request(&window, &connection.request_id)
        .await?
        .ok_or(GenericError("WebSocket Request not found".to_string()))?;

    let mut ws_manager = ws_manager.lock().await;
    match request.message_type {
        WebsocketMessageType::Text => {
            let msg = String::from_utf8(request.message).unwrap_or_default();
            ws_manager.send(&connection.id, Message::Text(msg.into())).await
        }
        WebsocketMessageType::Binary => {
            ws_manager.send(&connection.id, Message::Binary(request.message.into())).await
        }
    }?;

    Ok(connection)
}

#[tauri::command]
pub(crate) async fn cancel<R: Runtime>(
    connection_id: &str,
    window: WebviewWindow<R>,
    ws_manager: State<'_, Mutex<WebsocketManager>>,
) -> Result<WebsocketConnection> {
    let connection = get_websocket_connection(&window, connection_id).await?;
    let mut ws_manager = ws_manager.lock().await;
    ws_manager.cancel(&connection.id).await?;
    upsert_websocket_connection(
        &window,
        &WebsocketConnection {
            state: WebsocketConnectionState::Closed,
            ..connection.clone()
        },
        &UpdateSource::Window,
    )
    .await?;

    Ok(connection)
}

#[tauri::command]
pub(crate) async fn connect<R: Runtime>(
    request_id: &str,
    environment_id: Option<&str>,
    cookie_jar_id: Option<&str>,
    window: WebviewWindow<R>,
    plugin_manager: State<'_, PluginManager>,
    ws_manager: State<'_, Mutex<WebsocketManager>>,
) -> Result<WebsocketConnection> {
    let unrendered_request = get_websocket_request(&window, request_id)
        .await?
        .ok_or(GenericError("Failed to find GRPC request".to_string()))?;
    let environment = match environment_id {
        Some(id) => Some(get_environment(&window, id).await?),
        None => None,
    };
    let base_environment = get_base_environment(&window, &unrendered_request.workspace_id).await?;
    let request = render_request(
        &unrendered_request,
        &base_environment,
        environment.as_ref(),
        &PluginTemplateCallback::new(
            window.app_handle(),
            &WindowContext::from_window(&window),
            RenderPurpose::Send,
        ),
    )
    .await;

    let mut headers = HeaderMap::new();
    if let Some(auth_name) = request.authentication_type.clone() {
        let auth = request.authentication.clone();
        let plugin_req = CallHttpAuthenticationRequest {
            context_id: format!("{:x}", md5::compute(request_id.to_string())),
            values: serde_json::from_value(serde_json::to_value(&auth).unwrap()).unwrap(),
            method: "POST".to_string(),
            url: request.url.clone(),
            headers: request
                .headers
                .clone()
                .into_iter()
                .map(|h| HttpHeader {
                    name: h.name,
                    value: h.value,
                })
                .collect(),
        };
        let plugin_result =
            plugin_manager.call_http_authentication(&window, &auth_name, plugin_req).await?;
        for header in plugin_result.set_headers {
            headers.insert(
                HeaderName::from_str(&header.name).unwrap(),
                HeaderValue::from_str(&header.value).unwrap(),
            );
        }
    }

    // TODO: Handle cookies
    let _cookie_jar = match cookie_jar_id {
        Some(id) => Some(get_cookie_jar(&window, id).await?),
        None => None,
    };

    let connection = upsert_websocket_connection(
        &window,
        &WebsocketConnection {
            workspace_id: request.workspace_id.clone(),
            request_id: request_id.to_string(),
            ..Default::default()
        },
        &UpdateSource::Window,
    )
    .await?;

    let (receive_tx, mut receive_rx) = mpsc::channel::<Message>(128);
    let mut ws_manager = ws_manager.lock().await;

    {
        let connection_id = connection.id.clone();
        let request_id = request.id.to_string();
        let workspace_id = request.workspace_id.clone();
        let window = window.clone();
        tokio::spawn(async move {
            while let Some(message) = receive_rx.recv().await {
                upsert_websocket_event(
                    &window,
                    WebsocketEvent {
                        connection_id: connection_id.clone(),
                        request_id: request_id.clone(),
                        workspace_id: workspace_id.clone(),
                        message_type: match message {
                            Message::Text(_) => WebsocketEventType::Text,
                            Message::Binary(_) => WebsocketEventType::Binary,
                            Message::Ping(_) => WebsocketEventType::Ping,
                            Message::Pong(_) => WebsocketEventType::Pong,
                            Message::Close(_) => WebsocketEventType::Close,
                            Message::Frame(_) => WebsocketEventType::Frame,
                        },
                        content: message.into_data().into(),
                        ..Default::default()
                    },
                    &UpdateSource::Window,
                ).await.unwrap();
            }
            panic!("Didn't receive text message");
        });
    }

    let response = ws_manager.connect(&connection.id, &request.url, headers, receive_tx).await?;

    let response_headers = response
        .headers()
        .into_iter()
        .map(|(name, value)| HttpResponseHeader {
            name: name.to_string(),
            value: value.to_str().unwrap().to_string(),
        })
        .collect::<Vec<HttpResponseHeader>>();

    let connection = upsert_websocket_connection(
        &window,
        &WebsocketConnection {
            state: WebsocketConnectionState::Connected,
            headers: response_headers,
            ..connection
        },
        &UpdateSource::Window,
    )
    .await?;

    Ok(connection)
}
