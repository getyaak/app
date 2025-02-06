import type { Environment } from '@yaakapp-internal/models';
import { useSetAtom } from 'jotai';
import { InlineCode } from '../components/core/InlineCode';
import { trackEvent } from '../lib/analytics';
import { showConfirmDelete } from '../lib/confirm';
import { invokeCmd } from '../lib/tauri';
import { environmentsAtom } from './useEnvironments';
import { useFastMutation } from './useFastMutation';
import { removeModelById } from './useSyncModelStores';

export function useDeleteEnvironment(environment: Environment | null) {
  const setEnvironments = useSetAtom(environmentsAtom);

  return useFastMutation<Environment | null, string>({
    mutationKey: ['delete_environment', environment?.id],
    mutationFn: async () => {
      const confirmed = await showConfirmDelete({
        id: 'delete-environment',
        title: 'Delete Environment',
        description: (
          <>
            Permanently delete <InlineCode>{environment?.name}</InlineCode>?
          </>
        ),
      });
      if (!confirmed) return null;
      return invokeCmd('cmd_delete_environment', { environmentId: environment?.id });
    },
    onSettled: () => trackEvent('environment', 'delete'),
    onSuccess: (environment) => {
      if (environment == null) return;

      setEnvironments(removeModelById(environment));
    },
  });
}
