import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, RotateCcw } from 'lucide-react';
import type { StudioCompositionEntry } from '@make-pictures/core';

export function buildAiErrorContext(params: {
  error: Error;
  composition: StudioCompositionEntry;
  frame: number;
  propsSnapshot?: Record<string, unknown>;
}): string {
  const { error, composition, frame, propsSnapshot } = params;
  const lines = [
    `### Błąd podglądu w make.pictures Studio Web`,
    `- **Kompozycja:** \`${composition.id}\` (${composition.width}×${composition.height} @ ${composition.fps} FPS, kit: \`${composition.kit}\`)`,
    `- **Klatka na osi czasu:** \`${frame}\` / \`${composition.durationInFrames}\``,
    `- **Plik propsów:** \`${composition.propsFile}\``,
    `- **Komunikat błędu:** \`${error.name}: ${error.message}\``,
    '',
    '```text',
    error.stack || `${error.name}: ${error.message}`,
    '```',
  ];

  if (propsSnapshot && Object.keys(propsSnapshot).length > 0) {
    lines.push(
      '',
      '**Aktualne propsy kompozycji:**',
      '```json',
      JSON.stringify(propsSnapshot, null, 2),
      '```'
    );
  }

  lines.push(
    '',
    'Proszę napraw powyższy błąd runtime w tej kompozycji, zachowując determinizm 60 FPS.'
  );
  return lines.join('\n');
}

export const StageErrorCard: React.FC<{
  error: Error;
  composition: StudioCompositionEntry;
  frame: number;
  propsSnapshot?: Record<string, unknown>;
  onRetry: () => void;
}> = ({ error, composition, frame, propsSnapshot, onRetry }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyForAgent = async () => {
    const markdown = buildAiErrorContext({
      error,
      composition,
      frame,
      propsSnapshot,
    });
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="mp-error-card">
      <div className="mp-error-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'var(--mp-rose-soft)',
              border: '1px solid var(--mp-rose-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mp-rose)',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={19} />
          </div>
          <div>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 800,
                color: 'var(--mp-text-primary)',
              }}
            >
              Chwilowy błąd sceny ({composition.id})
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--mp-text-secondary)',
                marginTop: 2,
              }}
            >
              Zatrzymano na klatce {frame} • Studio Web działa dalej i czeka na poprawkę HMR
            </div>
          </div>
        </div>

        <pre className="mp-error-pre">
          {error.name}: {error.message}
          {error.stack ? `\n\n${error.stack.split('\n').slice(1, 7).join('\n')}` : ''}
        </pre>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="mp-icon-btn is-primary"
            onClick={handleCopyForAgent}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>
              {copied
                ? 'Skopiowano kontekst dla agenta!'
                : 'Kopiuj błąd dla agenta AI'}
            </span>
          </button>

          <button type="button" className="mp-icon-btn" onClick={onRetry}>
            <RotateCcw size={13} />
            <span>Spróbuj ponownie</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export interface StageErrorBoundaryProps {
  resetKey: string;
  composition: StudioCompositionEntry;
  getCurrentFrame: () => number;
  propsSnapshot?: Record<string, unknown>;
  onManualRetry: () => void;
  children: React.ReactNode;
}

interface StageErrorBoundaryState {
  error: Error | null;
}

export class StageErrorBoundary extends React.Component<
  StageErrorBoundaryProps,
  StageErrorBoundaryState
> {
  state: StageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StageErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: StageErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
    this.props.onManualRetry();
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <StageErrorCard
          error={this.state.error}
          composition={this.props.composition}
          frame={this.props.getCurrentFrame()}
          propsSnapshot={this.props.propsSnapshot}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
