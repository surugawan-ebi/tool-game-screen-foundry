"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLayerGroups,
  reorderLayerGroup,
  captureStructuredEditSnapshot,
  collectGeometryEditLayerIds,
  collectDependentPlacementIds,
  getStructuredContractSnapshotKey,
  syncOverlayAbsoluteGeometryForSpec,
  updateOverlaySlotFromGeometryForSpec
} = require("../public/placement-edit-logic");

function geometryEditFixture() {
  const spec = {
    placements: [
      { placementId: "base", x: 100, y: 100, width: 100, height: 80, zIndex: 10 },
      { placementId: "child", parentId: "base", x: 90, y: 90, width: 20, height: 20, zIndex: 20 },
      { placementId: "rider", x: 110, y: 110, width: 18, height: 18, zIndex: 30 }
    ],
    contentOverlays: [
      { overlayId: "top_left", targetPlacementId: "base", slot: { x: 10, y: 12, width: 30, height: 16 } },
      { overlayId: "center", targetPlacementId: "base", slot: { width: 20, height: 10 } },
      { overlayId: "bottom_right", targetPlacementId: "base", slot: { right: 8, bottom: 6, width: 20, height: 12 } },
      { overlayId: "child_text", targetPlacementId: "child", slot: { x: 0, y: 0, width: 10, height: 10 } },
      { overlayId: "absolute", targetPlacementId: "base", x: 100, y: 100, width: 20, height: 10 }
    ]
  };
  syncOverlayAbsoluteGeometryForSpec(spec);
  return spec;
}

function geometryEditIsLocked(ids, lockedId) {
  return ids.includes(lockedId);
}

test("the selected target remains in lock scope even without geometry changes", () => {
  const spec = geometryEditFixture();
  assert.deepEqual(collectGeometryEditLayerIds(spec, { selectedId: "base" }), ["base"]);
  assert.deepEqual(collectGeometryEditLayerIds(spec, { selectedId: "child_text" }), ["child_text"]);
});

test("a move with following off leaves locked children and riders editable but checks moving slot text", () => {
  const spec = geometryEditFixture();
  const before = JSON.stringify(spec);
  const ids = collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    placementUpdates: [{ ...spec.placements[0], x: 120, y: 110 }]
  });
  assert.deepEqual(ids.sort(), ["base", "top_left", "center", "bottom_right"].sort());
  for (const lockedId of ["child", "rider", "child_text", "absolute"]) {
    assert.equal(geometryEditIsLocked(ids, lockedId), false);
  }
  assert.equal(geometryEditIsLocked(ids, "top_left"), true);
  assert.equal(JSON.stringify(spec), before, "lock checks must not mutate the contract");
});

test("following moves protect the moved child, rider, and their slot overlays", () => {
  const spec = geometryEditFixture();
  const dependentIds = collectDependentPlacementIds({ placements: spec.placements, rootPlacementId: "base" });
  const ids = collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    placementUpdates: spec.placements.filter((item) => item.placementId === "base" || dependentIds.includes(item.placementId))
      .map((item) => ({ ...item, x: item.x + 20, y: item.y + 10 }))
  });
  for (const lockedId of ["base", "child", "rider", "top_left", "center", "bottom_right", "child_text"]) {
    assert.equal(geometryEditIsLocked(ids, lockedId), true, lockedId);
  }
  assert.equal(geometryEditIsLocked(ids, "absolute"), false);
});

test("centered resize ignores unchanged children and centered text while protecting changed edge slots", () => {
  const spec = geometryEditFixture();
  const ids = collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    placementUpdates: [{ ...spec.placements[0], width: 120, height: 100 }]
  });
  assert.deepEqual(ids.sort(), ["base", "top_left", "bottom_right"].sort());
  assert.equal(geometryEditIsLocked(ids, "child"), false);
  assert.equal(geometryEditIsLocked(ids, "center"), false);
  assert.equal(geometryEditIsLocked(ids, "bottom_right"), true);
});

test("pointer resize with a fixed top-left protects only slots whose geometry changes", () => {
  const spec = geometryEditFixture();
  const ids = collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    placementUpdates: [{ ...spec.placements[0], x: 110, y: 110, width: 120, height: 100 }]
  });
  assert.deepEqual(ids.sort(), ["base", "center", "bottom_right"].sort());
  assert.equal(geometryEditIsLocked(ids, "top_left"), false);
  assert.equal(geometryEditIsLocked(ids, "child"), false);
  assert.equal(geometryEditIsLocked(ids, "center"), true);
});

test("geometry scope respects write rounding and includes explicit overlay slot edits", () => {
  const spec = geometryEditFixture();
  assert.deepEqual(collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    placementUpdates: [{ ...spec.placements[0], x: 100.4 }, { ...spec.placements[1], x: 90.4 }]
  }), ["base"]);
  assert.deepEqual(collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    overlayUpdates: [{ ...spec.contentOverlays[0] }]
  }), ["base"], "an unchanged explicit write must not lock an unchanged slot");
  assert.deepEqual(collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    overlayUpdates: [{ ...spec.contentOverlays[2] }]
  }), ["base", "bottom_right"], "normalizing an anchored slot is an edit even at the same absolute geometry");
  const before = JSON.stringify(spec);
  const ids = collectGeometryEditLayerIds(spec, {
    selectedId: "base",
    placementUpdates: [{ ...spec.placements[0], x: 120 }],
    overlayUpdates: [{ ...spec.contentOverlays[4], x: 120 }]
  });
  assert.equal(geometryEditIsLocked(ids, "absolute"), true, "nudge and pointer moves also shift unslotted text");
  assert.equal(JSON.stringify(spec), before);
});

test("explicit overlay geometry normalizes anchors and remains stable through slot resync", () => {
  const spec = geometryEditFixture();
  const overlay = spec.contentOverlays[2];
  overlay.x += 9;
  overlay.y -= 7;
  overlay.slot.offsetX = 3;
  overlay.slot.offsetY = 2;
  const geometry = { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height };
  updateOverlaySlotFromGeometryForSpec(spec, overlay);
  for (const key of ["right", "bottom", "offsetX", "offsetY"]) {
    assert.equal(Object.hasOwn(overlay.slot, key), false);
  }
  syncOverlayAbsoluteGeometryForSpec(spec);
  assert.deepEqual({ x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height }, geometry);
});

test("global slot resync still protects locked overlays whose stored geometry would be corrected", () => {
  const spec = geometryEditFixture();
  spec.contentOverlays[3].x = -1;
  const ids = collectGeometryEditLayerIds(spec, { selectedId: "base" });
  assert.deepEqual(ids, ["base", "child_text"]);
  assert.equal(spec.contentOverlays[3].x, -1);
});

test("layer groups include text, sort front-first, and preserve equal-z membership", () => {
  const spec = {
    placements: [{ placementId: "base", zIndex: 0 }, { placementId: "a", zIndex: 10 }, { placementId: "b", zIndex: 10 }],
    contentOverlays: [{ overlayId: "text", zIndex: 20 }]
  };
  assert.deepEqual(getLayerGroups(spec).map((group) => group.zIndex), [20, 10, 0]);
  assert.equal(reorderLayerGroup(spec, {}, 10, 20), true);
  assert.deepEqual(spec.placements.map((item) => item.zIndex), [0, 20, 20]);
  assert.equal(spec.contentOverlays[0].zIndex, 10);
  assert.equal(reorderLayerGroup(spec, {}, 20, 20), false);
  assert.equal(reorderLayerGroup(spec, {}, 99, 20), false);
  assert.equal(reorderLayerGroup(spec, {}, 20, 0), true);
  assert.deepEqual(spec.placements.map((item) => item.zIndex), [10, 0, 0]);
  assert.equal(spec.contentOverlays[0].zIndex, 20);
});

test("reordering cannot move or cross locked layers and failure is atomic", () => {
  for (const lockedId of ["base", "middle", "text"]) {
    const spec = {
      placements: [{ placementId: "base", zIndex: -5 }, { placementId: "middle", zIndex: 0 }],
      contentOverlays: [{ overlayId: "text", zIndex: 10 }]
    };
    const before = JSON.stringify(spec);
    assert.throws(() => reorderLayerGroup(spec, { [lockedId]: { locked: true } }, 10, -5), /ロック/);
    assert.equal(JSON.stringify(spec), before);
  }
});

test("editor visibility and locks are undoable without becoming exported contract data", () => {
  const workspace = { materialSpecSheet: { placements: [] }, layerEditorState: { base: { hidden: true, locked: true } } };
  const before = captureStructuredEditSnapshot(workspace);
  workspace.layerEditorState.base.hidden = false;
  const after = captureStructuredEditSnapshot(workspace);
  assert.equal(before.layerEditorState.base.hidden, true);
  assert.notDeepEqual(before.layerEditorState, after.layerEditorState);
  assert.equal(getStructuredContractSnapshotKey(before), getStructuredContractSnapshotKey(after));
  assert.equal(before.materialSpecSheet.layerEditorState, undefined);
});

test("structured edit snapshots retain regeneration queue side effects without polluting contract dirty checks", () => {
  const workspaceState = {
    screenKv: { screenId: "home" },
    materialSpecSheet: { placements: [{ placementId: "button", width: 100 }] },
    worldPreset: { presetId: "default" },
    revisionMap: {},
    regenerationQueue: [{ queueId: "regen_button", assetId: "button" }],
    regenerationQueueDirty: true,
    regenerationPrompt: "regenerate button"
  };

  const snapshot = captureStructuredEditSnapshot(workspaceState);
  workspaceState.regenerationQueue[0].assetId = "changed";

  assert.deepEqual(snapshot.regenerationQueue, [{ queueId: "regen_button", assetId: "button" }]);
  assert.equal(snapshot.regenerationQueueDirty, true);
  assert.equal(snapshot.regenerationPrompt, "regenerate button");

  const queueOnlyChange = {
    ...snapshot,
    regenerationQueue: [],
    regenerationQueueDirty: false,
    regenerationPrompt: ""
  };
  assert.equal(
    getStructuredContractSnapshotKey(snapshot),
    getStructuredContractSnapshotKey(queueOnlyChange)
  );
});

test("placement edit dependents include children, group members, and stacked riders", () => {
  const placements = [
    { placementId: "base", x: 100, y: 100, width: 120, height: 80, zIndex: 10 },
    { placementId: "child", parentId: "base", x: 90, y: 90, width: 20, height: 20, zIndex: 20 },
    { placementId: "grandchild", parentId: "child", x: 92, y: 92, width: 12, height: 12, zIndex: 21 },
    { placementId: "group_layer", x: 110, y: 100, width: 40, height: 20, zIndex: 22 },
    { placementId: "group_child", x: 115, y: 105, width: 18, height: 18, zIndex: 23 },
    { placementId: "stacked_rider", x: 100, y: 110, width: 36, height: 20, zIndex: 30 },
    { placementId: "outside", x: 220, y: 100, width: 40, height: 20, zIndex: 40 },
    { placementId: "below", x: 100, y: 100, width: 30, height: 20, zIndex: 5 },
    { placementId: "foreign_child", parentId: "outside", x: 100, y: 100, width: 16, height: 16, zIndex: 50 }
  ];
  const compositionGroups = [
    {
      rootPlacementId: "base",
      layerPlacementIds: ["base", "group_layer"],
      childContentPlacementIds: ["group_child"]
    }
  ];

  assert.deepEqual(
    collectDependentPlacementIds({ placements, compositionGroups, rootPlacementId: "base" }).sort(),
    ["child", "grandchild", "group_child", "group_layer", "stacked_rider"].sort()
  );
});

test("overlay absolute geometry is recomputed from target slot", () => {
  const materialSpecSheet = {
    placements: [
      { placementId: "button", x: 200, y: 100, width: 120, height: 60 }
    ],
    contentOverlays: [
      {
        overlayId: "label",
        targetPlacementId: "button",
        slot: { x: 20, y: 12, width: 80, height: 24 },
        x: 0,
        y: 0,
        width: 1,
        height: 1
      },
      {
        overlayId: "right_counter",
        targetPlacementId: "button",
        slot: { right: 10, bottom: 8, width: 30, height: 18 }
      }
    ]
  };

  assert.equal(syncOverlayAbsoluteGeometryForSpec(materialSpecSheet), 2);
  assert.deepEqual(
    {
      x: materialSpecSheet.contentOverlays[0].x,
      y: materialSpecSheet.contentOverlays[0].y,
      width: materialSpecSheet.contentOverlays[0].width,
      height: materialSpecSheet.contentOverlays[0].height
    },
    { x: 200, y: 94, width: 80, height: 24 }
  );
  assert.deepEqual(
    {
      x: materialSpecSheet.contentOverlays[1].x,
      y: materialSpecSheet.contentOverlays[1].y,
      width: materialSpecSheet.contentOverlays[1].width,
      height: materialSpecSheet.contentOverlays[1].height
    },
    { x: 235, y: 113, width: 30, height: 18 }
  );
});
