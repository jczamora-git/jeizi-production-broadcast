const express = require("express");
const { pool } = require("../db");

const router = express.Router();
const finishedMatchStatuses = ["finished", "done", "completed"];

const getTeamLabel = (team) => team?.shortname || team?.short_name || team?.name || "-";

router.get("/", async (req, res) => {
  try {
    const [teams] = await pool.query(
      "SELECT id, name, shortname, logo FROM teams ORDER BY name ASC"
    );

    const [finishedGames] = await pool.query(
      `SELECT
         g.id,
         g.match_id,
         g.game_no,
         g.winner_team_id,
         g.status,
         g.finished_at,
         g.updated_at,
         m.blue_team_id,
         m.red_team_id,
         m.mode,
         m.title,
         m.series_completed,
         m.series_winner_team_id,
         m.status AS match_status
       FROM games g
       JOIN matches m ON m.id = g.match_id
       WHERE LOWER(g.status) = 'finished'
         AND g.winner_team_id IS NOT NULL`
    );

    const [seriesCompletedMatches] = await pool.query(
      `SELECT
         id,
         match_no,
         blue_team_id,
         red_team_id,
         mode,
         title,
         blue_score,
         red_score,
         status,
         created_at,
         updated_at,
         series_completed,
         series_winner_team_id,
         series_completed_at
       FROM matches
       WHERE series_completed = 1
         AND series_winner_team_id IS NOT NULL`
    );

    const finishedPlaceholders = finishedMatchStatuses.map(() => "?").join(",");
    const [recentMatchesSource] = await pool.query(
      `SELECT
         id,
         match_no,
         blue_team_id,
         red_team_id,
         mode,
         title,
         blue_score,
         red_score,
         status,
         created_at,
         updated_at,
         series_completed,
         series_winner_team_id,
         series_completed_at
       FROM matches
       WHERE series_completed = 1
          OR LOWER(status) IN (${finishedPlaceholders})
       ORDER BY
         series_completed_at DESC,
         updated_at DESC,
         created_at DESC,
         id DESC
       LIMIT 10`,
      finishedMatchStatuses
    );

    const standingsMap = new Map();

    teams.forEach((team) => {
      standingsMap.set(Number(team.id), {
        team_id: Number(team.id),
        team_name: team.name || "",
        team_shortname: team.shortname || "",
        team_logo: team.logo || "",
        match_wins: 0,
        match_losses: 0,
        match_points: 0,
        match_wl: "0-0",
        game_wins: 0,
        game_losses: 0,
        net_game_win: 0,
        games_wl: "0-0",
      });
    });

    finishedGames.forEach((game) => {
      const blueId = Number(game.blue_team_id);
      const redId = Number(game.red_team_id);
      const winnerId = Number(game.winner_team_id);

      if (!standingsMap.has(blueId) || !standingsMap.has(redId)) {
        return;
      }

      const blueTeam = standingsMap.get(blueId);
      const redTeam = standingsMap.get(redId);

      if (winnerId === blueId) {
        blueTeam.game_wins += 1;
        redTeam.game_losses += 1;
        return;
      }

      if (winnerId === redId) {
        redTeam.game_wins += 1;
        blueTeam.game_losses += 1;
      }
    });

    seriesCompletedMatches.forEach((match) => {
      const blueId = Number(match.blue_team_id);
      const redId = Number(match.red_team_id);
      const winnerId = Number(match.series_winner_team_id);

      if (!standingsMap.has(blueId) || !standingsMap.has(redId)) {
        return;
      }

      const blueTeam = standingsMap.get(blueId);
      const redTeam = standingsMap.get(redId);

      if (winnerId === blueId) {
        blueTeam.match_wins += 1;
        blueTeam.match_points += 1;
        redTeam.match_losses += 1;
        return;
      }

      if (winnerId === redId) {
        redTeam.match_wins += 1;
        redTeam.match_points += 1;
        blueTeam.match_losses += 1;
      }
    });

    const standings = Array.from(standingsMap.values()).map((team) => {
      const netGameWin = team.game_wins - team.game_losses;
      return {
        ...team,
        match_wl: `${team.match_wins}-${team.match_losses}`,
        net_game_win: netGameWin,
        games_wl: `${team.game_wins}-${team.game_losses}`,
      };
    });

    standings.sort((a, b) => {
      if (b.match_points !== a.match_points) {
        return b.match_points - a.match_points;
      }
      if (b.match_wins !== a.match_wins) {
        return b.match_wins - a.match_wins;
      }
      if (b.net_game_win !== a.net_game_win) {
        return b.net_game_win - a.net_game_win;
      }
      if (b.game_wins !== a.game_wins) {
        return b.game_wins - a.game_wins;
      }
      return getTeamLabel(a).localeCompare(getTeamLabel(b));
    });

    const rankedStandings = standings.map((team, index) => ({
      ...team,
      rank: index + 1,
    }));

    const teamsById = new Map();
    teams.forEach((team) => {
      teamsById.set(Number(team.id), team);
    });

    const recentMatches = recentMatchesSource.map((match) => {
      const blueTeam = teamsById.get(Number(match.blue_team_id));
      const redTeam = teamsById.get(Number(match.red_team_id));
      const blueScore = Number(match.blue_score || 0);
      const redScore = Number(match.red_score || 0);
      let winnerTeamId = match.series_winner_team_id
        ? Number(match.series_winner_team_id)
        : null;

      if (!winnerTeamId && blueScore !== redScore) {
        winnerTeamId =
          blueScore > redScore ? Number(match.blue_team_id) : Number(match.red_team_id);
      }

      return {
        match_id: match.id,
        match_no: match.match_no,
        title: match.title || "",
        mode: match.mode || "",
        status: match.status || "",
        updated_at: match.updated_at,
        created_at: match.created_at,
        series_completed_at: match.series_completed_at,
        blue_team_id: match.blue_team_id,
        red_team_id: match.red_team_id,
        blue_team_name: blueTeam?.name || "",
        red_team_name: redTeam?.name || "",
        blue_team_shortname: blueTeam?.shortname || "",
        red_team_shortname: redTeam?.shortname || "",
        blue_team_logo: blueTeam?.logo || "",
        red_team_logo: redTeam?.logo || "",
        blue_score: blueScore,
        red_score: redScore,
        winner_team_id: winnerTeamId,
      };
    });

    res.json({ standings: rankedStandings, recent_matches: recentMatches });
  } catch (error) {
    console.error("Failed to load standings", error);
    res.status(500).json({ message: "Failed to load standings" });
  }
});

module.exports = router;
