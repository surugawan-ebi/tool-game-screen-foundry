"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLayerGroups,
  reorderLayerGroup,
  captureStructuredEditSnapshot,
  collectDependentPlacementIds,
  getStructuredContractSnapshotKey,
  syncOverlayAbsoluteGeometryForSpec
} = require("../public/placement-edit-logic");

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
