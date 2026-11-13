export { StudioApp, type StudioAppProps } from './StudioApp';
export {
  extractStudioCompositionsFromModule,
  mergeStudioCompositionModules,
} from './discovery';
export { consumePostSseStream } from './sseClient';
export type {
  InspectorTabId,
  OverlaySettings,
  SaveStudioScenePayload,
  SceneAudioStatusItem,
  StudioCapsuleScenesGroup,
  StudioScenePatch,
  StudioScenesResponse,
  StudioStatusResponse,
} from './types';
export {
  attachPlayerLifecycle,
  useRemotionPlayer,
  type PlayerLifecycleCallbacks,
  type PlayerLifecycleEventName,
  type PlayerLifecycleTarget,
  type UseRemotionPlayerOptions,
  type UseRemotionPlayerResult,
} from './hooks/useRemotionPlayer';
export {
  STUDIO_THEME_STORAGE_KEY,
  useStudioTheme,
  type ResolvedStudioTheme,
  type StudioThemeMode,
  type UseStudioThemeResult,
} from './hooks/useStudioTheme';
export {
  formatColorWithAlpha,
  getNestedValue,
  introspectPropsFallback,
  introspectZodObject,
  mergeSchemaWithExtraProps,
  parseRgbaOrHex,
  setNestedValue,
  type InspectorFieldKind,
  type InspectorFieldSpec,
  type InspectorSection,
} from './schema-form/zodIntrospect';
export {
  DirectorOverlays,
  type DirectorOverlaysProps,
} from './components/DirectorOverlays';
export {
  DirectorTimelinePanel,
  type DirectorTimelinePanelProps,
} from './components/DirectorTimelinePanel';
export {
  LeftSidebar,
  type LeftSidebarProps,
  type OriginFilterMode,
} from './components/LeftSidebar';
export {
  LiveTranscriptBar,
  type LiveTranscriptBarProps,
} from './components/LiveTranscriptBar';
export {
  ProjectPickerPopover,
  type ProjectPickerPopoverProps,
  type ProjectPickerViewMode,
} from './components/ProjectPickerPopover';
export {
  PropsInspector,
  type PropsInspectorProps,
} from './components/PropsInspector';
export {
  SceneScriptEditor,
  type SceneScriptEditorProps,
} from './components/SceneScriptEditor';
export {
  buildAiErrorContext,
  StageErrorBoundary,
  StageErrorCard,
  type StageErrorBoundaryProps,
} from './components/StageErrorBoundary';
export {
  STUDIO_SHARED_AUDIO_TAGS,
  StageViewport,
  type StageViewportProps,
} from './components/StageViewport';
export {
  StyleCatalogSidebar,
  type StudioStyleCatalogItem,
  type StyleCatalogSidebarProps,
} from './components/StyleCatalogSidebar';
export {
  STYLE_LAB_DURATION_IN_FRAMES,
  STYLE_LAB_FPS,
  STYLE_LAB_KITS,
  StyleLabPreviewComposition,
  StyleLabShowcase,
  type StyleLabAspectRatio,
  type StyleLabCompositionProps,
  type StyleLabShowcaseProps,
} from './components/StyleLabShowcase';
export {
  Topbar,
  type StudioViewMode,
  type TopbarProps,
} from './components/Topbar';
export {
  BrandLogo,
  BrandMarkSvg,
  type BrandLogoProps,
  type BrandMarkSvgProps,
} from './components/BrandLogo';
