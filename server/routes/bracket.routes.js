const express = require("express");
const {
  generateSingleEliminationBracket,
} = require("../services/bracketGenerator");

const router = express.Router();

router.post("/preview", async (req, res) => {
  try {
    const participants = Array.isArray(req.body?.participants) ? req.body.participants : null;
    const roundModes = req.body?.roundModes || {};
    const options = req.body?.options || {};

    if (!participants) {
      return res.status(400).json({ message: "participants must be an array" });
    }

    if (participants.length < 2) {
      return res.status(400).json({ message: "At least 2 participants are required" });
    }

    const normalizedParticipants = participants
      .map((participant, index) => {
        const teamId = Number(participant?.team_id);
        const seed = Number(participant?.seed);

        if (!teamId || !seed) {
          throw new Error(`Participant ${index + 1} must include team_id and seed`);
        }

        return {
          team_id: teamId,
          seed,
          name: participant?.name || `Team ${teamId}`,
        };
      })
      .sort((left, right) => left.seed - right.seed);

    const seenSeeds = new Set();
    const seenTeamIds = new Set();

    for (const participant of normalizedParticipants) {
      if (seenSeeds.has(participant.seed)) {
        return res.status(400).json({ message: `Duplicate seed found: ${participant.seed}` });
      }
      if (seenTeamIds.has(participant.team_id)) {
        return res
          .status(400)
          .json({ message: `Duplicate team_id found: ${participant.team_id}` });
      }
      seenSeeds.add(participant.seed);
      seenTeamIds.add(participant.team_id);
    }

    const bracket = generateSingleEliminationBracket(normalizedParticipants, {
      roundModes,
      bracketType: options.bracketType,
      seedingMode: options.seedingMode,
      includeThirdPlace: options.includeThirdPlace,
      thirdPlaceMode: roundModes["Battle for Third"],
    });

    res.json({
      success: true,
      bracket,
    });
  } catch (error) {
    if (error?.message?.includes("must include team_id and seed")) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Failed to preview bracket", error);
    res.status(500).json({ message: "Failed to preview bracket" });
  }
});

module.exports = router;
