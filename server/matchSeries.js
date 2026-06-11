const { pool } = require("./db");

function getRequiredWins(mode) {
  return Math.ceil(getMaxGamesByMode(mode) / 2);
}

function getMaxGamesByMode(mode) {
  const normalized = String(mode || "").toUpperCase();

  if (normalized === "BO1") return 1;
  if (normalized === "BO3") return 3;
  if (normalized === "BO5") return 5;
  if (normalized === "BO7") return 7;

  return 1;
}

function getReopenedMatchStatus(hasOtherLiveMatch) {
  return hasOtherLiveMatch ? "queued" : "live";
}

async function recalculateMatchSeriesState(matchId, connection = pool) {
  if (!matchId) {
    return null;
  }

  const [matchRows] = await connection.query(
    `SELECT id, mode, blue_team_id, red_team_id, blue_score, red_score, status,
            series_completed, series_winner_team_id, series_completed_at
     FROM matches
     WHERE id = ?
     LIMIT 1`,
    [matchId]
  );
  const match = matchRows[0];

  if (!match) {
    return null;
  }

  const [winRows] = await connection.query(
    `SELECT winner_team_id, COUNT(*) AS wins
     FROM games
     WHERE match_id = ?
       AND LOWER(status) = 'finished'
       AND winner_team_id IS NOT NULL
     GROUP BY winner_team_id`,
    [matchId]
  );

  let blueWins = 0;
  let redWins = 0;

  winRows.forEach((row) => {
    if (String(row.winner_team_id) === String(match.blue_team_id)) {
      blueWins = Number(row.wins || 0);
    } else if (String(row.winner_team_id) === String(match.red_team_id)) {
      redWins = Number(row.wins || 0);
    }
  });

  const requiredWins = getRequiredWins(match.mode);
  const blueReached = blueWins >= requiredWins;
  const redReached = redWins >= requiredWins;
  const seriesCompleted = blueReached || redReached;
  const seriesWinnerTeamId = blueReached
    ? match.blue_team_id
    : redReached
      ? match.red_team_id
      : null;

  if (seriesCompleted) {
    await connection.query(
      `UPDATE matches
       SET blue_score = ?,
           red_score = ?,
           series_completed = 1,
           series_winner_team_id = ?,
           series_completed_at = COALESCE(series_completed_at, NOW()),
           status = 'finished',
           updated_at = NOW()
       WHERE id = ?`,
      [blueWins, redWins, seriesWinnerTeamId, matchId]
    );
  } else {
    let nextStatus = match.status;
    if (String(match.status || "").toLowerCase() === "finished") {
      const [liveRows] = await connection.query(
        `SELECT id
         FROM matches
         WHERE id <> ?
           AND LOWER(status) IN ('live', 'active', 'ongoing')
         LIMIT 1`,
        [matchId]
      );
      nextStatus = getReopenedMatchStatus(liveRows.length > 0);
    }

    await connection.query(
      `UPDATE matches
       SET blue_score = ?,
           red_score = ?,
           series_completed = 0,
           series_winner_team_id = NULL,
           series_completed_at = NULL,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [blueWins, redWins, nextStatus, matchId]
    );
  }

  return {
    match,
    blueWins,
    redWins,
    requiredWins,
    seriesCompleted,
    seriesWinnerTeamId,
  };
}

module.exports = {
  getMaxGamesByMode,
  getRequiredWins,
  getReopenedMatchStatus,
  recalculateMatchSeriesState,
};
