"use strict";

const APPROVED_STATUS = "approved";
const REFERENCE_MODES = new Set(["key_visual", "reference_images", "text_only"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nonEmptyList(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/**
 * Check the small, machine-readable gate that must be passed before an
 * imagegen handoff is created or adopted.
 *
 * The visual direction itself remains in the existing world-preset fields.
 * creativeDirection is deliberately only the decision record and reference
 * policy, so it does not introduce a second copy of the palette or mood.
 */
function validateCreativeDirection(worldPreset) {
  const direction = worldPreset && worldPreset.creativeDirection;
  const errors = [];

  if (!direction || typeof direction !== "object" || Array.isArray(direction)) {
    errors.push("worldPreset.creativeDirection is required");
  } else if (direction.status !== APPROVED_STATUS) {
    errors.push('worldPreset.creativeDirection.status must be "approved"');
  }

  if (!direction || typeof direction !== "object" || Array.isArray(direction)) {
    return {
      ok: false,
      status: "missing",
      errors,
      message: `Creative direction gate blocked imagegen handoff: ${errors.join("; ")}.`
    };
  }

  const referenceMode = text(direction.referenceMode);
  if (!referenceMode) {
    errors.push(
      "worldPreset.creativeDirection.referenceMode is required"
    );
  } else if (!REFERENCE_MODES.has(referenceMode)) {
    errors.push(
      `worldPreset.creativeDirection.referenceMode must be one of ${[...REFERENCE_MODES].join(", ")}`
    );
  }

  const visualThesis = text(direction.visualThesis);
  if (!visualThesis || visualThesis.length < 8 || /[\r\n]/u.test(visualThesis)) {
    errors.push(
      "worldPreset.creativeDirection.visualThesis must be one concise sentence (at least 8 characters)"
    );
  }

  if (nonEmptyList(worldPreset && worldPreset.moodKeywords).length < 3) {
    errors.push("worldPreset.moodKeywords must contain at least 3 non-empty keywords");
  }
  const palette = worldPreset && worldPreset.palette && typeof worldPreset.palette === "object"
    ? worldPreset.palette
    : {};
  for (const key of ["primary", "secondary", "accent", "neutralDark", "neutralLight"]) {
    if (!text(palette[key])) {
      errors.push(`worldPreset.palette.${key} is required for the creative direction gate`);
    }
  }
  if (!text(worldPreset && worldPreset.shapeLanguage)) {
    errors.push("worldPreset.shapeLanguage is required for the creative direction gate");
  }
  if (nonEmptyList(worldPreset && worldPreset.materialKeywords).length < 2) {
    errors.push("worldPreset.materialKeywords must contain at least 2 non-empty keywords");
  }
  if (!text(worldPreset && worldPreset.lightingStyle)) {
    errors.push("worldPreset.lightingStyle is required for the creative direction gate");
  }
  if (!text(worldPreset && worldPreset.detailDensity)) {
    errors.push("worldPreset.detailDensity is required for the creative direction gate");
  }
  if (!nonEmptyList(direction.mustHave).length) {
    errors.push("worldPreset.creativeDirection.mustHave must contain at least one item");
  }
  if (!nonEmptyList(direction.mustNotHave).length) {
    errors.push("worldPreset.creativeDirection.mustNotHave must contain at least one item");
  }

  if (referenceMode === "text_only" && !text(direction.textOnlyRationale)) {
    errors.push(
      "worldPreset.creativeDirection.textOnlyRationale is required when referenceMode is text_only"
    );
  }

  if (referenceMode === "reference_images") {
    const references = worldPreset && Array.isArray(worldPreset.referenceImages)
      ? worldPreset.referenceImages.filter(Boolean)
      : [];
    if (!references.length) {
      errors.push(
        "worldPreset.referenceImages must contain at least one image when referenceMode is reference_images"
      );
    }
  }

  if (referenceMode === "key_visual") {
    const references = worldPreset && Array.isArray(worldPreset.referenceImages)
      ? worldPreset.referenceImages.filter(Boolean)
      : [];
    if (!references.length && !text(direction.keyVisualReference)) {
      errors.push(
        "worldPreset.referenceImages or creativeDirection.keyVisualReference is required when referenceMode is key_visual"
      );
    }
  }

  if (errors.length) {
    return {
      ok: false,
      status: direction.status === APPROVED_STATUS ? "invalid" : "unapproved",
      errors,
      message: `Creative direction gate blocked imagegen handoff: ${errors.join("; ")}.`
    };
  }

  return {
    ok: true,
    status: APPROVED_STATUS,
    referenceMode: referenceMode || "unspecified",
    errors: [],
    message: "Creative direction gate passed."
  };
}

function assertCreativeDirectionApproved(worldPreset) {
  const result = validateCreativeDirection(worldPreset);
  if (!result.ok) {
    const error = new Error(result.message);
    error.code = "CREATIVE_DIRECTION_NOT_APPROVED";
    error.direction = result;
    throw error;
  }
  return result;
}

module.exports = {
  APPROVED_STATUS,
  REFERENCE_MODES,
  assertCreativeDirectionApproved,
  validateCreativeDirection
};
