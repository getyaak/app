import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { LicenseCheckStatus } from './bindings/license';

export * from './bindings/license';

export function useLicense() {
  const queryClient = useQueryClient();
  const activate = useMutation<void, string, { licenseKey: string }>({
    mutationKey: ['license.activate'],
    mutationFn: (payload) => invoke('plugin:yaak-license|activate', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHECK_QUERY_KEY }),
  });

  // Check the license again after a license is activated
  useEffect(() => {
    listen('license-activated', () => {
      queryClient.invalidateQueries({ queryKey: CHECK_QUERY_KEY }).catch(console.error);
    }).then(console.error);
  }, []);

  const CHECK_QUERY_KEY = ['license.check'];
  const check = useQuery<void, string, LicenseCheckStatus>({
    queryKey: CHECK_QUERY_KEY,
    queryFn: () => invoke('plugin:yaak-license|check'),
  });

  return {
    activate,
    check,
  } as const;
}