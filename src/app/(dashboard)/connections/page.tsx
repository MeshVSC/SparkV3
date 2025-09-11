import { ConnectionManager } from '@/components/connections/ConnectionManager'

export default function ConnectionsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Connection Management</h1>
        <p className="text-muted-foreground mt-2">
          View, manage, and track the history of all your spark connections
        </p>
      </div>
      
      <ConnectionManager />
    </div>
  )
}