import { Metadata } from "next"
import { WorkspaceManagement } from "@/components/workspace-management"

export const metadata: Metadata = {
  title: "Workspace Management - Spark",
  description: "Manage your workspaces and collaborate with team members"
}

export default function WorkspacesPage() {
  return <WorkspaceManagement />
}
