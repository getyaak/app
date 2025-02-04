import type { Workspace } from '@yaakapp-internal/models';
import { differenceInMilliseconds } from 'date-fns';
import { createFastMutation } from '../hooks/useFastMutation';
import { trackEvent } from '../lib/analytics';
import { invokeCmd } from '../lib/tauri';

export const upsertWorkspace = createFastMutation<
  Workspace,
  void,
  Workspace | Partial<Omit<Workspace, 'id'>>
>({
  mutationKey: ['upsert_workspace'],
  mutationFn: (workspace) => invokeCmd<Workspace>('cmd_update_workspace', { workspace }),
  onSuccess: async (workspace) => {
    const isNew = differenceInMilliseconds(new Date(), workspace.createdAt + 'Z') < 100;

    if (isNew) trackEvent('workspace', 'create');
    else trackEvent('workspace', 'update');
  },
});
