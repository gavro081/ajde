'use client'

import { StatusPanel } from '@/components/status-panel'

export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  return <StatusPanel tone="error" eyebrow="Connection error" title="The profile did not load" actions={<button type="button" onClick={reset} className="btn-primary">Try again</button>}>
    <p>The service may be temporarily unavailable. Your session and data are safe.</p>
  </StatusPanel>
}
