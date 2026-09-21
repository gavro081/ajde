import Link from 'next/link'
import { StatusPanel } from '@/components/status-panel'

export default function ProfileNotFound() {
  return <StatusPanel eyebrow="Profile" title="Student not found" actions={<Link href="/rides" className="btn-primary">Browse rides</Link>}>
    <p>This profile may not exist yet, or it may no longer be available.</p>
  </StatusPanel>
}
