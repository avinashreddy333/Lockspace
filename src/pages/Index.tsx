import { WelcomeScreen } from "../components/WelcomeScreen";
import { WorkspaceView } from "../components/WorkspaceView";
import { useWorkspace } from "../lib/workspace-context";

export default function Index() {
  const { isWorkspaceUnlocked } = useWorkspace();

  if (isWorkspaceUnlocked) {
    return <WorkspaceView />;
  }

  return <WelcomeScreen />;
}