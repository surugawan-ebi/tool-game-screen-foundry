(function attachPlacementEditLogic(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.GameScreenFoundryPlacementEditLogic = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function createPlacementEditLogic() {
  function cloneValue(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function captureStructuredEditSnapshot(workspaceState) {
    return {
      screenKv: cloneValue(workspaceState.screenKv),
      materialSpecSheet: cloneValue(workspaceState.materialSpecSheet),
      worldPreset: cloneValue(workspaceState.worldPreset),
      revisionMap: cloneValue(workspaceState.revisionMap || {}),
      layerEditorState: cloneValue(workspaceState.layerEditorState || {}),
      regenerationQueue: cloneValue(workspaceState.regenerationQueue || []),
      regenerationQueueDirty: Boolean(workspaceState.regenerationQueueDirty),
      regenerationPrompt: String(workspaceState.regenerationPrompt || "")
    };
  }

  function getStructuredContractSnapshotKey(snapshot) {
    return JSON.stringify({
      screenKv: snapshot.screenKv,
      materialSpecSheet: snapshot.materialSpecSheet,
      worldPreset: snapshot.worldPreset,
      revisionMap: snapshot.revisionMap || {}
    });
  }

  function placementBox(placement) {
    return {
      left: placement.x - placement.width / 2,
      top: placement.y - placement.height / 2,
      right: placement.x + placement.width / 2,
      bottom: placement.y + placement.height / 2
    };
  }

  function collectDependentPlacementIds({ placements = [], compositionGroups = [], rootPlacementId }) {
    const rootPlacement = placements.find((placement) => placement.placementId === rootPlacementId);
    if (!rootPlacement) {
      return [];
    }

    const movedIds = new Set([rootPlacement.placementId]);
    let changed = true;
    while (changed) {
      changed = false;

      for (const placement of placements) {
        if (movedIds.has(placement.placementId)) {
          continue;
        }
        if (placement.parentId && movedIds.has(placement.parentId)) {
          movedIds.add(placement.placementId);
          changed = true;
        }
      }

      for (const group of compositionGroups) {
        if (!movedIds.has(group.rootPlacementId)) {
          continue;
        }
        const members = [
          ...(Array.isArray(group.layerPlacementIds) ? group.layerPlacementIds : []),
          ...(Array.isArray(group.childContentPlacementIds) ? group.childContentPlacementIds : [])
        ];
        for (const memberId of members) {
          if (memberId && !movedIds.has(memberId)) {
            movedIds.add(memberId);
            changed = true;
          }
        }
      }

      const rootBox = placementBox(rootPlacement);
      const paddedRoot = {
        left: rootBox.left - 1.5,
        top: rootBox.top - 1.5,
        right: rootBox.right + 1.5,
        bottom: rootBox.bottom + 1.5
      };
      for (const placement of placements) {
        if (movedIds.has(placement.placementId)) {
          continue;
        }
        if (placement.parentId && !movedIds.has(placement.parentId)) {
          continue;
        }
        if (placement.zIndex <= rootPlacement.zIndex) {
          continue;
        }
        const box = placementBox(placement);
        if (
          box.left >= paddedRoot.left
          && box.top >= paddedRoot.top
          && box.right <= paddedRoot.right
          && box.bottom <= paddedRoot.bottom
        ) {
          movedIds.add(placement.placementId);
          changed = true;
        }
      }
    }

    movedIds.delete(rootPlacement.placementId);
    return [...movedIds];
  }

  function syncOverlayAbsoluteGeometryForSpec(materialSpecSheet) {
    const overlays = materialSpecSheet && Array.isArray(materialSpecSheet.contentOverlays)
      ? materialSpecSheet.contentOverlays
      : [];
    const placements = materialSpecSheet && Array.isArray(materialSpecSheet.placements)
      ? materialSpecSheet.placements
      : [];
    const placementById = new Map(placements.map((placement) => [placement.placementId, placement]));
    let updated = 0;

    for (const overlay of overlays) {
      if (!overlay.slot || !overlay.targetPlacementId || !placementById.has(overlay.targetPlacementId)) {
        continue;
      }
      const target = placementById.get(overlay.targetPlacementId);
      const targetLeft = target.x - target.width / 2;
      const targetTop = target.y - target.height / 2;
      const slot = overlay.slot;
      const width = Math.max(Number(slot.width || overlay.width || 1), 1);
      const height = Math.max(Number(slot.height || overlay.height || 1), 1);
      const offsetX = Number(slot.offsetX || 0);
      const offsetY = Number(slot.offsetY || 0);
      const left = Object.prototype.hasOwnProperty.call(slot, "x")
        ? targetLeft + Number(slot.x) + offsetX
        : Object.prototype.hasOwnProperty.call(slot, "right")
          ? targetLeft + target.width - Number(slot.right) - width + offsetX
          : targetLeft + (target.width - width) / 2 + offsetX;
      const top = Object.prototype.hasOwnProperty.call(slot, "y")
        ? targetTop + Number(slot.y) + offsetY
        : Object.prototype.hasOwnProperty.call(slot, "bottom")
          ? targetTop + target.height - Number(slot.bottom) - height + offsetY
          : targetTop + (target.height - height) / 2 + offsetY;

      overlay.x = Math.round((left + width / 2) * 10) / 10;
      overlay.y = Math.round((top + height / 2) * 10) / 10;
      overlay.width = width;
      overlay.height = height;
      updated += 1;
    }

    return updated;
  }

  function updateOverlaySlotFromGeometryForSpec(spec, overlay) {
    if (!overlay || !overlay.targetPlacementId) {
      return;
    }
    const target = (spec.placements || []).find((placement) => placement.placementId === overlay.targetPlacementId);
    if (!target) {
      return;
    }
    const targetLeft = target.x - target.width / 2;
    const targetTop = target.y - target.height / 2;
    overlay.slot = {
      ...(overlay.slot || {}),
      x: Math.round((overlay.x - overlay.width / 2 - targetLeft) * 10) / 10,
      y: Math.round((overlay.y - overlay.height / 2 - targetTop) * 10) / 10,
      width: overlay.width,
      height: overlay.height
    };
    delete overlay.slot.right;
    delete overlay.slot.bottom;
    delete overlay.slot.offsetX;
    delete overlay.slot.offsetY;
  }

  function getLayerGroups(spec) {
    const groups = new Map();
    for (const item of [...(spec.placements || []), ...(spec.contentOverlays || [])]) {
      const zIndex = Number(item.zIndex);
      if (!groups.has(zIndex)) {
        groups.set(zIndex, { zIndex, items: [] });
      }
      groups.get(zIndex).items.push(item);
    }
    return [...groups.values()].sort((left, right) => right.zIndex - left.zIndex);
  }

  // Updates describe the geometry writes the operation will actually perform.
  // Re-sync slots on copies so unchanged children and anchored text do not
  // become locked dependencies merely because their parent is selected.
  function collectGeometryEditLayerIds(spec, { selectedId, placementUpdates = [], overlayUpdates = [] }) {
    const nextSpec = {
      placements: (spec.placements || []).map((item) => ({ ...item })),
      contentOverlays: (spec.contentOverlays || []).map((item) => ({ ...item }))
    };
    const ids = new Set(selectedId ? [selectedId] : []);
    const geometryKeys = ["x", "y", "width", "height"];
    const geometryChanged = (before, after) => geometryKeys.some((key) => before[key] !== after[key]);
    const applyGeometry = (item, update) => {
      item.x = Math.round(update.x);
      item.y = Math.round(update.y);
      item.width = Math.max(1, Math.round(update.width));
      item.height = Math.max(1, Math.round(update.height));
    };

    for (const update of placementUpdates) {
      const item = nextSpec.placements.find((placement) => placement.placementId === update.placementId);
      if (!item) {
        continue;
      }
      const before = { ...item };
      applyGeometry(item, update);
      if (geometryChanged(before, item)) {
        ids.add(item.placementId);
      }
    }

    for (const update of overlayUpdates) {
      const item = nextSpec.contentOverlays.find((overlay) => overlay.overlayId === update.overlayId);
      if (!item) {
        continue;
      }
      const before = { ...item };
      applyGeometry(item, update);
      updateOverlaySlotFromGeometryForSpec(nextSpec, item);
      if (geometryChanged(before, item) || JSON.stringify(before.slot) !== JSON.stringify(item.slot)) {
        ids.add(item.overlayId);
      }
    }
    syncOverlayAbsoluteGeometryForSpec(nextSpec);
    nextSpec.contentOverlays.forEach((item, index) => {
      if (geometryChanged(spec.contentOverlays[index], item)) {
        ids.add(item.overlayId);
      }
    });
    return [...ids];
  }

  function reorderLayerGroup(spec, editorState, sourceZ, targetZ) {
    const groups = getLayerGroups(spec);
    const sourceIndex = groups.findIndex((group) => group.zIndex === sourceZ);
    const targetIndex = groups.findIndex((group) => group.zIndex === targetZ);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return false;
    }
    const affected = groups.slice(Math.min(sourceIndex, targetIndex), Math.max(sourceIndex, targetIndex) + 1);
    if (affected.some((group) => group.items.some((item) => (editorState[item.placementId || item.overlayId] || {}).locked))) {
      throw new Error("ロックされたレイヤーをまたぐ並べ替えはできません。");
    }
    const levels = groups.map((group) => group.zIndex);
    const [moved] = groups.splice(sourceIndex, 1);
    groups.splice(targetIndex, 0, moved);
    groups.forEach((group, index) => {
      group.items.forEach((item) => { item.zIndex = levels[index]; });
    });
    return true;
  }

  return {
    getLayerGroups,
    reorderLayerGroup,
    captureStructuredEditSnapshot,
    collectGeometryEditLayerIds,
    collectDependentPlacementIds,
    getStructuredContractSnapshotKey,
    syncOverlayAbsoluteGeometryForSpec,
    updateOverlaySlotFromGeometryForSpec
  };
});
