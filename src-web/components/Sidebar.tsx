import type { Folder, GrpcRequest, HttpRequest, Workspace } from '@yaakapp-internal/models';
import classNames from 'classnames';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createGlobalState, useKey, useKeyPressEvent } from 'react-use';

import { useActiveRequest } from '../hooks/useActiveRequest';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import { useCreateDropdownItems } from '../hooks/useCreateDropdownItems';
import { useDuplicateGrpcRequest } from '../hooks/useDuplicateGrpcRequest';
import { useDuplicateHttpRequest } from '../hooks/useDuplicateHttpRequest';
import { useFolders } from '../hooks/useFolders';
import { useGrpcConnections } from '../hooks/useGrpcConnections';
import { useHotKey } from '../hooks/useHotKey';
import { useHttpRequestActions } from '../hooks/useHttpRequestActions';
import { useHttpResponses } from '../hooks/useHttpResponses';
import { useKeyValue } from '../hooks/useKeyValue';
import { useRequests } from '../hooks/useRequests';
import { useSidebarHidden } from '../hooks/useSidebarHidden';
import { useUpdateAnyFolder } from '../hooks/useUpdateAnyFolder';
import { useUpdateAnyGrpcRequest } from '../hooks/useUpdateAnyGrpcRequest';
import { useUpdateAnyHttpRequest } from '../hooks/useUpdateAnyHttpRequest';
import { router } from '../main';
import { Route } from '../routes/workspaces/$workspaceId/requests/$requestId';
import { ContextMenu } from './core/Dropdown';
import type { SidebarItemProps } from './SidebarItem';
import { SidebarItems } from './SidebarItems';

interface Props {
  className?: string;
}

export interface SidebarTreeNode {
  item: Workspace | Folder | HttpRequest | GrpcRequest;
  children: SidebarTreeNode[];
  depth: number;
}

export const useSidebarSelectedId = createGlobalState<string | null>(null);

export function Sidebar({ className }: Props) {
  const [hidden, setHidden] = useSidebarHidden();
  const sidebarRef = useRef<HTMLLIElement>(null);
  const activeRequest = useActiveRequest();
  const folders = useFolders();
  const requests = useRequests();
  const activeWorkspace = useActiveWorkspace();
  const httpRequestActions = useHttpRequestActions();
  const httpResponses = useHttpResponses();
  const grpcConnections = useGrpcConnections();
  const duplicateHttpRequest = useDuplicateHttpRequest({
    id: activeRequest?.id ?? null,
    navigateAfter: true,
  });
  const duplicateGrpcRequest = useDuplicateGrpcRequest({
    id: activeRequest?.id ?? null,
    navigateAfter: true,
  });
  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useSidebarSelectedId();
  const [selectedTree, setSelectedTree] = useState<SidebarTreeNode | null>(null);
  const { mutateAsync: updateAnyHttpRequest } = useUpdateAnyHttpRequest();
  const { mutateAsync: updateAnyGrpcRequest } = useUpdateAnyGrpcRequest();
  const { mutateAsync: updateAnyFolder } = useUpdateAnyFolder();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredTree, setHoveredTree] = useState<SidebarTreeNode | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { value: collapsed, set: setCollapsed } = useKeyValue<Record<string, boolean>>({
    key: ['sidebar_collapsed', activeWorkspace?.id ?? 'n/a'],
    fallback: {},
    namespace: 'no_sync',
  });

  useHotKey('http_request.duplicate', async () => {
    if (activeRequest?.model === 'http_request') {
      await duplicateHttpRequest.mutateAsync();
    } else {
      await duplicateGrpcRequest.mutateAsync();
    }
  });

  const isCollapsed = useCallback((id: string) => collapsed?.[id] ?? false, [collapsed]);

  const { tree, treeParentMap, selectableRequests } = useMemo<{
    tree: SidebarTreeNode | null;
    treeParentMap: Record<string, SidebarTreeNode>;
    selectableRequests: {
      id: string;
      index: number;
      tree: SidebarTreeNode;
    }[];
  }>(() => {
    const childrenMap: Record<string, (HttpRequest | GrpcRequest | Folder)[]> = {};
    for (const item of [...requests, ...folders]) {
      if (item.folderId == null) {
        childrenMap[item.workspaceId] = childrenMap[item.workspaceId] ?? [];
        childrenMap[item.workspaceId]!.push(item);
      } else {
        childrenMap[item.folderId] = childrenMap[item.folderId] ?? [];
        childrenMap[item.folderId]!.push(item);
      }
    }

    const treeParentMap: Record<string, SidebarTreeNode> = {};
    const selectableRequests: {
      id: string;
      index: number;
      tree: SidebarTreeNode;
    }[] = [];

    if (activeWorkspace == null) {
      return { tree: null, treeParentMap, selectableRequests };
    }

    const selectedRequest: HttpRequest | GrpcRequest | null = null;
    let selectableRequestIndex = 0;

    // Put requests and folders into a tree structure
    const next = (node: SidebarTreeNode): SidebarTreeNode => {
      const childItems = childrenMap[node.item.id] ?? [];

      // Recurse to children
      const isCollapsed = collapsed?.[node.item.id];
      const depth = node.depth + 1;
      childItems.sort((a, b) => a.sortPriority - b.sortPriority);
      for (const item of childItems) {
        treeParentMap[item.id] = node;
        // Add to children
        node.children.push(next({ item, children: [], depth }));
        // Add to selectable requests
        if (item.model !== 'folder' && !isCollapsed) {
          selectableRequests.push({ id: item.id, index: selectableRequestIndex++, tree: node });
        }
      }

      return node;
    };

    const tree = next({ item: activeWorkspace, children: [], depth: 0 });

    return { tree, treeParentMap, selectableRequests, selectedRequest };
  }, [activeWorkspace, requests, folders, collapsed]);

  const focusActiveRequest = useCallback(
    (
      args: {
        forced?: {
          id: string;
          tree: SidebarTreeNode;
        };
        noFocusSidebar?: boolean;
      } = {},
    ) => {
      const { forced, noFocusSidebar } = args;
      const tree = forced?.tree ?? treeParentMap[activeRequest?.id ?? 'n/a'] ?? null;
      const children = tree?.children ?? [];
      const id =
        forced?.id ?? children.find((m) => m.item.id === activeRequest?.id)?.item.id ?? null;

      setHasFocus(true);
      setSelectedId(id);
      setSelectedTree(tree);

      if (id == null) {
        return;
      }
      if (!noFocusSidebar) {
        sidebarRef.current?.focus();
      }
    },
    [activeRequest?.id, setSelectedId, treeParentMap],
  );

  const handleSelect = useCallback(
    async (id: string) => {
      const tree = treeParentMap[id ?? 'n/a'] ?? null;
      const children = tree?.children ?? [];
      const node = children.find((m) => m.item.id === id) ?? null;
      if (node == null || tree == null || node.item.model === 'workspace') {
        return;
      }

      const { item } = node;

      if (item.model === 'folder') {
        await setCollapsed((c) => ({ ...c, [item.id]: !c[item.id] }));
      } else {
        router.navigate({
          to: Route.fullPath,
          params: {
            requestId: id,
            workspaceId: item.workspaceId,
          },
          search: (prev) => ({ ...prev }),
        });
        setSelectedId(id);
        setSelectedTree(tree);
      }
    },
    [treeParentMap, setCollapsed, setSelectedId],
  );

  const handleClearSelected = useCallback(() => {
    setSelectedId(null);
    setSelectedTree(null);
  }, [setSelectedId]);

  const handleFocus = useCallback(() => {
    if (hasFocus) return;
    focusActiveRequest({ noFocusSidebar: true });
  }, [focusActiveRequest, hasFocus]);

  const handleBlur = useCallback(() => setHasFocus(false), []);

  useHotKey('sidebar.focus', async () => {
    // Hide the sidebar if it's already focused
    if (!hidden && hasFocus) {
      await setHidden(true);
      return;
    }

    // Show the sidebar if it's hidden
    if (hidden) {
      await setHidden(false);
    }

    // Select 0th index on focus if none selected
    focusActiveRequest(
      selectedTree != null && selectedId != null
        ? { forced: { id: selectedId, tree: selectedTree } }
        : undefined,
    );
  });

  useKeyPressEvent('Enter', (e) => {
    if (!hasFocus) return;
    const selected = selectableRequests.find((r) => r.id === selectedId);
    if (!selected || selected.id === activeRequest?.id || activeWorkspace == null) {
      return;
    }

    e.preventDefault();
    router.navigate({
      to: Route.fullPath,
      params: {
        requestId: selected.id,
        workspaceId: activeWorkspace?.id ?? null,
      },
      search: (prev) => ({ ...prev }),
    });
  });

  useKey(
    'ArrowUp',
    (e) => {
      if (!hasFocus) return;
      e.preventDefault();
      const i = selectableRequests.findIndex((r) => r.id === selectedId);
      const newSelectable = selectableRequests[i - 1];
      if (newSelectable == null) {
        return;
      }

      setSelectedId(newSelectable.id);
      setSelectedTree(newSelectable.tree);
    },
    undefined,
    [hasFocus, selectableRequests, selectedId, setSelectedId, setSelectedTree],
  );

  useKey(
    'ArrowDown',
    (e) => {
      if (!hasFocus) return;
      e.preventDefault();
      const i = selectableRequests.findIndex((r) => r.id === selectedId);
      const newSelectable = selectableRequests[i + 1];
      if (newSelectable == null) {
        return;
      }

      setSelectedId(newSelectable.id);
      setSelectedTree(newSelectable.tree);
    },
    undefined,
    [hasFocus, selectableRequests, selectedId, setSelectedId, setSelectedTree],
  );

  const handleMove = useCallback<SidebarItemProps['onMove']>(
    (id, side) => {
      let hoveredTree = treeParentMap[id] ?? null;
      const dragIndex = hoveredTree?.children.findIndex((n) => n.item.id === id) ?? -99;
      const hoveredItem = hoveredTree?.children[dragIndex]?.item ?? null;
      let hoveredIndex = dragIndex + (side === 'above' ? 0 : 1);

      if (hoveredItem?.model === 'folder' && side === 'below' && !isCollapsed(hoveredItem.id)) {
        // Move into the folder if it's open and we're moving below it
        hoveredTree = hoveredTree?.children.find((n) => n.item.id === id) ?? null;
        hoveredIndex = 0;
      }

      setHoveredTree(hoveredTree);
      setHoveredIndex(hoveredIndex);
    },
    [isCollapsed, treeParentMap],
  );

  const handleDragStart = useCallback<SidebarItemProps['onDragStart']>((id: string) => {
    setDraggingId(id);
  }, []);

  const handleEnd = useCallback<SidebarItemProps['onEnd']>(
    async (itemId) => {
      setHoveredTree(null);
      handleClearSelected();

      if (hoveredTree == null || hoveredIndex == null) {
        return;
      }

      // Block dragging folder into itself
      if (hoveredTree.item.id === itemId) {
        return;
      }

      const parentTree = treeParentMap[itemId] ?? null;
      const index = parentTree?.children.findIndex((n) => n.item.id === itemId) ?? -1;
      const child = parentTree?.children[index ?? -1];
      if (child == null || parentTree == null) return;

      const movedToDifferentTree = hoveredTree.item.id !== parentTree.item.id;
      const movedUpInSameTree = !movedToDifferentTree && hoveredIndex < index;

      const newChildren = hoveredTree.children.filter((c) => c.item.id !== itemId);
      if (movedToDifferentTree || movedUpInSameTree) {
        // Moving up or into a new tree is simply inserting before the hovered item
        newChildren.splice(hoveredIndex, 0, child);
      } else {
        // Moving down has to account for the fact that the original item will be removed
        newChildren.splice(hoveredIndex - 1, 0, child);
      }

      const insertedIndex = newChildren.findIndex((c) => c.item === child.item);
      const prev = newChildren[insertedIndex - 1]?.item;
      const next = newChildren[insertedIndex + 1]?.item;
      const beforePriority = prev == null || prev.model === 'workspace' ? 0 : prev.sortPriority;
      const afterPriority = next == null || next.model === 'workspace' ? 0 : next.sortPriority;

      const folderId = hoveredTree.item.model === 'folder' ? hoveredTree.item.id : null;
      const shouldUpdateAll = afterPriority - beforePriority < 1;

      if (shouldUpdateAll) {
        await Promise.all(
          newChildren.map((child, i) => {
            const sortPriority = i * 1000;
            if (child.item.model === 'folder') {
              const updateFolder = (f: Folder) => ({ ...f, sortPriority, folderId });
              return updateAnyFolder({ id: child.item.id, update: updateFolder });
            } else if (child.item.model === 'grpc_request') {
              const updateRequest = (r: GrpcRequest) => ({ ...r, sortPriority, folderId });
              return updateAnyGrpcRequest({ id: child.item.id, update: updateRequest });
            } else if (child.item.model === 'http_request') {
              const updateRequest = (r: HttpRequest) => ({ ...r, sortPriority, folderId });
              return updateAnyHttpRequest({ id: child.item.id, update: updateRequest });
            }
          }),
        );
      } else {
        const sortPriority = afterPriority - (afterPriority - beforePriority) / 2;
        if (child.item.model === 'folder') {
          const updateFolder = (f: Folder) => ({ ...f, sortPriority, folderId });
          await updateAnyFolder({ id: child.item.id, update: updateFolder });
        } else if (child.item.model === 'grpc_request') {
          const updateRequest = (r: GrpcRequest) => ({ ...r, sortPriority, folderId });
          await updateAnyGrpcRequest({ id: child.item.id, update: updateRequest });
        } else if (child.item.model === 'http_request') {
          const updateRequest = (r: HttpRequest) => ({ ...r, sortPriority, folderId });
          await updateAnyHttpRequest({ id: child.item.id, update: updateRequest });
        }
      }
      setDraggingId(null);
    },
    [
      handleClearSelected,
      hoveredTree,
      hoveredIndex,
      treeParentMap,
      updateAnyFolder,
      updateAnyGrpcRequest,
      updateAnyHttpRequest,
    ],
  );

  const [showMainContextMenu, setShowMainContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleMainContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMainContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const mainContextMenuItems = useCreateDropdownItems();

  // Not ready to render yet
  if (tree == null || collapsed == null) {
    return null;
  }

  return (
    <aside
      aria-hidden={hidden}
      ref={sidebarRef}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={hidden ? -1 : 0}
      onContextMenu={handleMainContextMenu}
      className={classNames(className, 'h-full grid grid-rows-[minmax(0,1fr)_auto]')}
    >
      <div className="pb-3 overflow-x-visible overflow-y-scroll pt-2">
        <ContextMenu
          triggerPosition={showMainContextMenu}
          items={mainContextMenuItems}
          onClose={() => setShowMainContextMenu(null)}
        />
        <SidebarItems
          treeParentMap={treeParentMap}
          selectedTree={selectedTree}
          isCollapsed={isCollapsed}
          httpRequestActions={httpRequestActions}
          httpResponses={httpResponses}
          grpcConnections={grpcConnections}
          tree={tree}
          activeId={activeRequest?.id ?? null}
          focused={hasFocus}
          draggingId={draggingId}
          onSelect={handleSelect}
          hoveredIndex={hoveredIndex}
          hoveredTree={hoveredTree}
          handleMove={handleMove}
          handleEnd={handleEnd}
          handleDragStart={handleDragStart}
        />
      </div>
    </aside>
  );
}
