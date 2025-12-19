import { WelcomeScreen } from '@/components/WelcomeScreen';
import { WorkspaceView } from '@/components/WorkspaceView';
import { useWorkspace } from '@/lib/workspace-context';

const Index = () => {
  const { isWorkspaceUnlocked } = useWorkspace();
  
  return isWorkspaceUnlocked ? <WorkspaceView /> : <WelcomeScreen />;
};

export default Index;
