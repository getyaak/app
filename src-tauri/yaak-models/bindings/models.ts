// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.

export type AnyModel = CookieJar | Environment | Folder | GrpcConnection | GrpcEvent | GrpcRequest | HttpRequest | HttpResponse | Plugin | Settings | KeyValue | Workspace;

export type Cookie = { raw_cookie: string, domain: CookieDomain, expires: CookieExpires, path: [string, boolean], };

export type CookieDomain = { "HostOnly": string } | { "Suffix": string } | "NotPresent" | "Empty";

export type CookieExpires = { "AtUtc": string } | "SessionEnd";

export type CookieJar = { model: "cookie_jar", id: string, createdAt: string, updatedAt: string, workspaceId: string, cookies: Array<Cookie>, name: string, };

export type Environment = { model: "environment", id: string, workspaceId: string, environmentId: string | null, createdAt: string, updatedAt: string, name: string, variables: Array<EnvironmentVariable>, };

export type EnvironmentVariable = { enabled?: boolean, name: string, value: string, id: string, };

export type Folder = { model: "folder", id: string, createdAt: string, updatedAt: string, workspaceId: string, folderId: string | null, name: string, description: string, sortPriority: number, };

export type GrpcConnection = { model: "grpc_connection", id: string, createdAt: string, updatedAt: string, workspaceId: string, requestId: string, elapsed: number, error: string | null, method: string, service: string, status: number, state: GrpcConnectionState, trailers: { [key in string]?: string }, url: string, };

export type GrpcConnectionState = "initialized" | "connected" | "closed";

export type GrpcEvent = { model: "grpc_event", id: string, createdAt: string, updatedAt: string, workspaceId: string, requestId: string, connectionId: string, content: string, error: string | null, eventType: GrpcEventType, metadata: { [key in string]?: string }, status: number | null, };

export type GrpcEventType = "info" | "error" | "client_message" | "server_message" | "connection_start" | "connection_end";

export type GrpcMetadataEntry = { enabled?: boolean, name: string, value: string, id: string, };

export type GrpcRequest = { model: "grpc_request", id: string, createdAt: string, updatedAt: string, workspaceId: string, folderId: string | null, authenticationType: string | null, authentication: Record<string, any>, description: string, message: string, metadata: Array<GrpcMetadataEntry>, method: string | null, name: string, service: string | null, sortPriority: number, url: string, };

export type HttpRequest = { model: "http_request", id: string, createdAt: string, updatedAt: string, workspaceId: string, folderId: string | null, authentication: Record<string, any>, authenticationType: string | null, body: Record<string, any>, bodyType: string | null, description: string, headers: Array<HttpRequestHeader>, method: string, name: string, sortPriority: number, url: string, urlParameters: Array<HttpUrlParameter>, };

export type HttpRequestHeader = { enabled?: boolean, name: string, value: string, id: string, };

export type HttpResponse = { model: "http_response", id: string, createdAt: string, updatedAt: string, workspaceId: string, requestId: string, bodyPath: string | null, contentLength: number | null, elapsed: number, elapsedHeaders: number, error: string | null, headers: Array<HttpResponseHeader>, remoteAddr: string | null, status: number, statusReason: string | null, state: HttpResponseState, url: string, version: string | null, };

export type HttpResponseHeader = { name: string, value: string, };

export type HttpResponseState = "initialized" | "connected" | "closed";

export type HttpUrlParameter = { enabled?: boolean, name: string, value: string, id: string, };

export type KeyValue = { model: "key_value", createdAt: string, updatedAt: string, key: string, namespace: string, value: string, };

export type ModelPayload = { model: AnyModel, windowLabel: string, updateSource: UpdateSource, };

export type Plugin = { model: "plugin", id: string, createdAt: string, updatedAt: string, checkedAt: string | null, directory: string, enabled: boolean, url: string | null, };

export type ProxySetting = { "type": "enabled", http: string, https: string, auth: ProxySettingAuth | null, } | { "type": "disabled" };

export type ProxySettingAuth = { user: string, password: string, };

export type Settings = { model: "settings", id: string, createdAt: string, updatedAt: string, appearance: string, editorFontSize: number, editorSoftWrap: boolean, interfaceFontSize: number, interfaceScale: number, openWorkspaceNewWindow: boolean | null, telemetry: boolean, theme: string, themeDark: string, themeLight: string, updateChannel: string, proxy: ProxySetting | null, };

export type SyncState = { model: "sync_state", id: string, workspaceId: string, createdAt: string, updatedAt: string, flushedAt: string, modelId: string, checksum: string, path: string, };

export type UpdateSource = "sync" | "window" | "plugin" | "background";

export type Workspace = { model: "workspace", id: string, createdAt: string, updatedAt: string, name: string, description: string, settingValidateCertificates: boolean, settingFollowRedirects: boolean, settingRequestTimeout: number, settingSyncDir: string | null, };