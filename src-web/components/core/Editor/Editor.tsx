import { defaultKeymap, historyField } from '@codemirror/commands';
import { foldState, forceParsing } from '@codemirror/language';
import type { EditorStateConfig, Extension } from '@codemirror/state';
import { Compartment, EditorState } from '@codemirror/state';
import { keymap, placeholder as placeholderExt, tooltips } from '@codemirror/view';
import { emacs } from '@replit/codemirror-emacs';
import { vim } from '@replit/codemirror-vim';
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap';
import type { EditorKeymap, EnvironmentVariable } from '@yaakapp-internal/models';
import type { TemplateFunction } from '@yaakapp-internal/plugins';
import classNames from 'classnames';
import { EditorView } from 'codemirror';
import type { MutableRefObject, ReactNode } from 'react';
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useActiveEnvironmentVariables } from '../../../hooks/useActiveEnvironmentVariables';
import { parseTemplate } from '../../../hooks/useParseTemplate';
import { useRequestEditor } from '../../../hooks/useRequestEditor';
import { useSettings } from '../../../hooks/useSettings';
import { useTemplateFunctionCompletionOptions } from '../../../hooks/useTemplateFunctions';
import { showDialog } from '../../../lib/dialog';
import { TemplateFunctionDialog } from '../../TemplateFunctionDialog';
import { TemplateVariableDialog } from '../../TemplateVariableDialog';
import { IconButton } from '../IconButton';
import { HStack } from '../Stacks';
import './Editor.css';
import { baseExtensions, getLanguageExtension, multiLineExtensions } from './extensions';
import type { GenericCompletionConfig } from './genericCompletion';
import { singleLineExtensions } from './singleLine';

const keymapExtensions: Record<EditorKeymap, Extension> = {
  vim: vim(),
  emacs: emacs(),
  vscode: keymap.of(vscodeKeymap),
  default: [],
};

export interface EditorProps {
  id?: string;
  readOnly?: boolean;
  disabled?: boolean;
  type?: 'text' | 'password';
  className?: string;
  heightMode?: 'auto' | 'full';
  language?:
    | 'javascript'
    | 'json'
    | 'html'
    | 'xml'
    | 'graphql'
    | 'url'
    | 'pairs'
    | 'text'
    | 'markdown';
  forceUpdateKey?: string | number;
  autoFocus?: boolean;
  autoSelect?: boolean;
  defaultValue?: string | null;
  placeholder?: string;
  tooltipContainer?: HTMLElement;
  useTemplating?: boolean;
  onChange?: (value: string) => void;
  onPaste?: (value: string) => void;
  onPasteOverwrite?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  singleLine?: boolean;
  wrapLines?: boolean;
  format?: (v: string) => Promise<string>;
  autocomplete?: GenericCompletionConfig;
  autocompleteVariables?: boolean;
  extraExtensions?: Extension[];
  actions?: ReactNode;
  hideGutter?: boolean;
  stateKey: string | null;
}

const stateFields = { history: historyField, folds: foldState };

const emptyVariables: EnvironmentVariable[] = [];
const emptyExtension: Extension = [];

// NOTE: For some reason, the cursor doesn't appear if the field is empty and there is no
//  placeholder. So we set it to a space to force it to show.
const emptyPlaceholder = ' ';

export const Editor = forwardRef<EditorView | undefined, EditorProps>(function Editor(
  {
    readOnly,
    type = 'text',
    heightMode,
    language = 'text',
    autoFocus,
    autoSelect,
    placeholder,
    useTemplating,
    defaultValue,
    forceUpdateKey,
    onChange,
    onPaste,
    onPasteOverwrite,
    onFocus,
    onBlur,
    onKeyDown,
    className,
    singleLine,
    format,
    autocomplete,
    extraExtensions,
    autocompleteVariables,
    actions,
    wrapLines,
    hideGutter,
    stateKey,
  }: EditorProps,
  ref,
) {
  const settings = useSettings();

  const allEnvironmentVariables = useActiveEnvironmentVariables();
  const environmentVariables = autocompleteVariables ? allEnvironmentVariables : emptyVariables;

  if (settings && wrapLines === undefined) {
    wrapLines = settings.editorSoftWrap;
  }

  const cm = useRef<{ view: EditorView; languageCompartment: Compartment } | null>(null);
  useImperativeHandle(ref, () => cm.current?.view, []);

  // Use ref so we can update the handler without re-initializing the editor
  const handleChange = useRef<EditorProps['onChange']>(onChange);
  useEffect(() => {
    handleChange.current = onChange;
  }, [onChange]);

  // Use ref so we can update the handler without re-initializing the editor
  const handlePaste = useRef<EditorProps['onPaste']>(onPaste);
  useEffect(() => {
    handlePaste.current = onPaste;
  }, [onPaste]);

  // Use ref so we can update the handler without re-initializing the editor
  const handlePasteOverwrite = useRef<EditorProps['onPasteOverwrite']>(onPaste);
  useEffect(() => {
    handlePasteOverwrite.current = onPasteOverwrite;
  }, [onPasteOverwrite]);

  // Use ref so we can update the handler without re-initializing the editor
  const handleFocus = useRef<EditorProps['onFocus']>(onFocus);
  useEffect(() => {
    handleFocus.current = onFocus;
  }, [onFocus]);

  // Use ref so we can update the handler without re-initializing the editor
  const handleBlur = useRef<EditorProps['onBlur']>(onBlur);
  useEffect(() => {
    handleBlur.current = onBlur;
  }, [onBlur]);

  // Use ref so we can update the handler without re-initializing the editor
  const handleKeyDown = useRef<EditorProps['onKeyDown']>(onKeyDown);
  useEffect(() => {
    handleKeyDown.current = onKeyDown;
  }, [onKeyDown]);

  // Update placeholder
  const placeholderCompartment = useRef(new Compartment());
  useEffect(
    function configurePlaceholder() {
      if (cm.current === null) return;
      const ext = placeholderExt(placeholderElFromText(placeholder || emptyPlaceholder));
      const effect = placeholderCompartment.current.reconfigure(ext);
      cm.current?.view.dispatch({ effects: effect });
    },
    [placeholder],
  );

  // Update vim
  const keymapCompartment = useRef(new Compartment());
  useEffect(
    function configureKeymap() {
      if (cm.current === null) return;
      const current = keymapCompartment.current.get(cm.current.view.state) ?? [];
      // PERF: This is expensive with hundreds of editors on screen, so only do it when necessary
      if (settings.editorKeymap === 'default' && current === keymapExtensions['default']) return; // Nothing to do
      if (settings.editorKeymap === 'vim' && current === keymapExtensions['vim']) return; // Nothing to do
      if (settings.editorKeymap === 'vscode' && current === keymapExtensions['vscode']) return; // Nothing to do
      if (settings.editorKeymap === 'emacs' && current === keymapExtensions['emacs']) return; // Nothing to do

      const ext = keymapExtensions[settings.editorKeymap] ?? keymapExtensions['default'];
      const effect = keymapCompartment.current.reconfigure(ext);
      cm.current.view.dispatch({ effects: effect });
    },
    [settings.editorKeymap],
  );

  // Update wrap lines
  const wrapLinesCompartment = useRef(new Compartment());
  useEffect(
    function configureWrapLines() {
      if (cm.current === null) return;
      const current = wrapLinesCompartment.current.get(cm.current.view.state) ?? emptyExtension;
      // PERF: This is expensive with hundreds of editors on screen, so only do it when necessary
      if (wrapLines && current !== emptyExtension) return; // Nothing to do
      if (!wrapLines && current === emptyExtension) return; // Nothing to do

      const ext = wrapLines ? EditorView.lineWrapping : [];
      const effect = wrapLinesCompartment.current.reconfigure(ext);
      cm.current?.view.dispatch({ effects: effect });
    },
    [wrapLines],
  );

  const onClickFunction = useCallback(
    async (fn: TemplateFunction, tagValue: string, startPos: number) => {
      const initialTokens = await parseTemplate(tagValue);
      showDialog({
        id: 'template-function',
        size: 'sm',
        title: 'Configure Function',
        description: fn.description,
        render: ({ hide }) => (
          <TemplateFunctionDialog
            templateFunction={fn}
            hide={hide}
            initialTokens={initialTokens}
            onChange={(insert) => {
              cm.current?.view.dispatch({
                changes: [{ from: startPos, to: startPos + tagValue.length, insert }],
              });
            }}
          />
        ),
      });
    },
    [],
  );

  const onClickVariable = useCallback(
    async (_v: EnvironmentVariable, tagValue: string, startPos: number) => {
      const initialTokens = await parseTemplate(tagValue);
      showDialog({
        size: 'dynamic',
        id: 'template-variable',
        title: 'Change Variable',
        render: ({ hide }) => (
          <TemplateVariableDialog
            hide={hide}
            initialTokens={initialTokens}
            onChange={(insert) => {
              cm.current?.view.dispatch({
                changes: [{ from: startPos, to: startPos + tagValue.length, insert }],
              });
            }}
          />
        ),
      });
    },
    [],
  );

  const onClickMissingVariable = useCallback(
    async (_name: string, tagValue: string, startPos: number) => {
      const initialTokens = await parseTemplate(tagValue);
      showDialog({
        size: 'dynamic',
        id: 'template-variable',
        title: 'Configure Variable',
        render: ({ hide }) => (
          <TemplateVariableDialog
            hide={hide}
            initialTokens={initialTokens}
            onChange={(insert) => {
              cm.current?.view.dispatch({
                changes: [{ from: startPos, to: startPos + tagValue.length, insert }],
              });
            }}
          />
        ),
      });
    },
    [],
  );

  const [, { focusParamValue }] = useRequestEditor();
  const onClickPathParameter = useCallback(
    async (name: string) => {
      focusParamValue(name);
    },
    [focusParamValue],
  );

  const completionOptions = useTemplateFunctionCompletionOptions(onClickFunction);

  // Update the language extension when the language changes
  useEffect(() => {
    if (cm.current === null) return;
    const { view, languageCompartment } = cm.current;
    const ext = getLanguageExtension({
      language,
      environmentVariables,
      useTemplating,
      autocomplete,
      completionOptions,
      onClickVariable,
      onClickMissingVariable,
      onClickPathParameter,
    });
    view.dispatch({ effects: languageCompartment.reconfigure(ext) });
  }, [
    language,
    autocomplete,
    useTemplating,
    environmentVariables,
    onClickFunction,
    onClickVariable,
    onClickMissingVariable,
    onClickPathParameter,
    completionOptions,
  ]);

  // Initialize the editor when ref mounts
  const initEditorRef = useCallback(
    function initEditorRef(container: HTMLDivElement | null) {
      if (container === null) {
        cm.current?.view.destroy();
        cm.current = null;
        return;
      }

      try {
        const languageCompartment = new Compartment();
        const langExt = getLanguageExtension({
          language,
          useTemplating,
          completionOptions,
          autocomplete,
          environmentVariables,
          onClickVariable,
          onClickMissingVariable,
          onClickPathParameter,
        });

        const extensions = [
          languageCompartment.of(langExt),
          placeholderCompartment.current.of(
            placeholderExt(placeholderElFromText(placeholder || emptyPlaceholder)),
          ),
          wrapLinesCompartment.current.of(wrapLines ? EditorView.lineWrapping : []),
          keymapCompartment.current.of(
            keymapExtensions[settings.editorKeymap] ?? keymapExtensions['default'],
          ),
          ...getExtensions({
            container,
            readOnly,
            singleLine,
            hideGutter,
            stateKey,
            onChange: handleChange,
            onPaste: handlePaste,
            onPasteOverwrite: handlePasteOverwrite,
            onFocus: handleFocus,
            onBlur: handleBlur,
            onKeyDown: handleKeyDown,
          }),
          ...(extraExtensions ?? []),
        ];

        const cachedJsonState = getCachedEditorState(defaultValue ?? '', stateKey);

        const doc = `${defaultValue ?? ''}`;
        const config: EditorStateConfig = { extensions, doc };

        const state = cachedJsonState
          ? EditorState.fromJSON(cachedJsonState, config, stateFields)
          : EditorState.create(config);

        const view = new EditorView({ state, parent: container });

        // For large documents, the parser may parse the max number of lines and fail to add
        // things like fold markers because of it.
        // This forces it to parse more but keeps the timeout to the default of 100 ms.
        forceParsing(view, 9e6, 100);

        cm.current = { view, languageCompartment };
        if (autoFocus) {
          view.focus();
        }
        if (autoSelect) {
          view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
        }
      } catch (e) {
        console.log('Failed to initialize Codemirror', e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forceUpdateKey],
  );

  // For read-only mode, update content when `defaultValue` changes
  useEffect(
    function updateReadOnlyEditor() {
      if (!readOnly || cm.current?.view == null || defaultValue == null) return;

      // Replace codemirror contents
      const currentDoc = cm.current.view.state.doc.toString();
      if (defaultValue.startsWith(currentDoc)) {
        // If we're just appending, append only the changes. This preserves
        // things like scroll position.
        cm.current.view.dispatch({
          changes: cm.current.view.state.changes({
            from: currentDoc.length,
            insert: defaultValue.slice(currentDoc.length),
          }),
        });
      } else {
        // If we're replacing everything, reset the entire content
        cm.current.view.dispatch({
          changes: cm.current.view.state.changes({
            from: 0,
            to: currentDoc.length,
            insert: defaultValue,
          }),
        });
      }
    },
    [defaultValue, readOnly],
  );

  // Add bg classes to actions, so they appear over the text
  const decoratedActions = useMemo(() => {
    const results = [];
    const actionClassName = classNames(
      'bg-surface transition-opacity transform-gpu opacity-0 group-hover:opacity-100 hover:!opacity-100 shadow',
    );

    if (format) {
      results.push(
        <IconButton
          showConfirm
          key="format"
          size="sm"
          title="Reformat contents"
          icon="magic_wand"
          variant="border"
          className={classNames(actionClassName)}
          onClick={async () => {
            if (cm.current === null) return;
            const { doc } = cm.current.view.state;
            const formatted = await format(doc.toString());
            // Update editor and blur because the cursor will reset anyway
            cm.current.view.dispatch({
              changes: { from: 0, to: doc.length, insert: formatted },
            });
            cm.current.view.contentDOM.blur();
            // Fire change event
            onChange?.(formatted);
          }}
        />,
      );
    }
    results.push(
      Children.map(actions, (existingChild) => {
        if (!isValidElement(existingChild)) return null;
        return cloneElement(existingChild, {
          ...existingChild.props,
          className: classNames(existingChild.props.className, actionClassName),
        });
      }),
    );
    return results;
  }, [actions, format, onChange]);

  const cmContainer = (
    <div
      ref={initEditorRef}
      className={classNames(
        className,
        'cm-wrapper text-base',
        type === 'password' && 'cm-obscure-text',
        heightMode === 'auto' ? 'cm-auto-height' : 'cm-full-height',
        singleLine ? 'cm-singleline' : 'cm-multiline',
        readOnly && 'cm-readonly',
      )}
    />
  );

  if (singleLine) {
    return cmContainer;
  }

  return (
    <div className="group relative h-full w-full x-theme-editor bg-surface">
      {cmContainer}
      {decoratedActions && (
        <HStack
          space={1}
          justifyContent="end"
          className={classNames(
            'absolute bottom-2 left-0 right-0',
            'pointer-events-none', // No pointer events, so we don't block the editor
          )}
        >
          {decoratedActions}
        </HStack>
      )}
    </div>
  );
});

function getExtensions({
  stateKey,
  container,
  readOnly,
  singleLine,
  hideGutter,
  onChange,
  onPaste,
  onPasteOverwrite,
  onFocus,
  onBlur,
  onKeyDown,
}: Pick<EditorProps, 'singleLine' | 'readOnly' | 'hideGutter'> & {
  stateKey: EditorProps['stateKey'];
  container: HTMLDivElement | null;
  onChange: MutableRefObject<EditorProps['onChange']>;
  onPaste: MutableRefObject<EditorProps['onPaste']>;
  onPasteOverwrite: MutableRefObject<EditorProps['onPasteOverwrite']>;
  onFocus: MutableRefObject<EditorProps['onFocus']>;
  onBlur: MutableRefObject<EditorProps['onBlur']>;
  onKeyDown: MutableRefObject<EditorProps['onKeyDown']>;
}) {
  // TODO: Ensure tooltips render inside the dialog if we are in one.
  const parent =
    container?.closest<HTMLDivElement>('[role="dialog"]') ??
    document.querySelector<HTMLDivElement>('#cm-portal') ??
    undefined;

  return [
    ...baseExtensions, // Must be first
    EditorView.domEventHandlers({
      focus: () => {
        onFocus.current?.();
      },
      blur: () => {
        onBlur.current?.();
      },
      keydown: (e) => {
        onKeyDown.current?.(e);
      },
      paste: (e, v) => {
        const textData = e.clipboardData?.getData('text/plain') ?? '';
        onPaste.current?.(textData);
        if (v.state.selection.main.from === 0 && v.state.selection.main.to === v.state.doc.length) {
          onPasteOverwrite.current?.(textData);
        }
      },
    }),
    tooltips({ parent }),
    keymap.of(singleLine ? defaultKeymap.filter((k) => k.key !== 'Enter') : defaultKeymap),
    ...(singleLine ? [singleLineExtensions()] : []),
    ...(!singleLine ? [multiLineExtensions({ hideGutter })] : []),
    ...(readOnly
      ? [EditorState.readOnly.of(true), EditorView.contentAttributes.of({ tabindex: '-1' })]
      : []),

    // ------------------------ //
    // Things that must be last //
    // ------------------------ //

    // Fire onChange event
    EditorView.updateListener.of((update) => {
      if (onChange && update.docChanged) {
        onChange.current?.(update.state.doc.toString());
      }
    }),

    // Cache editor state
    EditorView.updateListener.of((update) => {
      saveCachedEditorState(stateKey, update.state);
    }),
  ];
}

const placeholderElFromText = (text: string) => {
  const el = document.createElement('div');
  el.innerHTML = text.replaceAll('\n', '<br/>');
  return el;
};

function saveCachedEditorState(stateKey: string | null, state: EditorState | null) {
  if (!stateKey || state == null) return;
  sessionStorage.setItem(
    computeFullStateKey(stateKey),
    JSON.stringify(state.toJSON(stateFields)),
  );
}

function getCachedEditorState(doc: string, stateKey: string | null) {
  if (stateKey == null) return;

  const stateStr = sessionStorage.getItem(computeFullStateKey(stateKey));
  if (stateStr == null) return null;

  try {
    const state = JSON.parse(stateStr);
    if (state.doc !== doc) return null;

    return state;
  } catch {
    // Nothing
  }

  return null;
}

function computeFullStateKey(stateKey: string): string {
  return `editor.${stateKey}`;
}
