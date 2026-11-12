export { StudioApp, type StudioAppProps } from './StudioApp';
export {
  extractStudioCompositionsFromModule,
  mergeStudioCompositionModules,
} from './discovery';
export { consumePostSseStream } from './sseClient';
export type {
  OverlaySettings,
  SceneAudioStatusItem,
  StudioStatusResponse,
} from './types';
export {
  getNestedValue,
  introspectZodObject,
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
  PropsInspector,
  type PropsInspectorProps,
} from './components/PropsInspector';
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
export { Topbar, type TopbarProps } from './components/Topbar';
export {
  BrandLogo,
  BrandMarkSvg,
  type BrandLogoProps,
  type BrandMarkSvgProps,
} from './components/BrandLogo';
