const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { pool } = require("./db");

const teamsRoutes = require("./routes/teams.routes");
const matchesRoutes = require("./routes/matches.routes");
const gamesRoutes = require("./routes/games.routes");
const mapsRoutes = require("./routes/maps.routes");
const heroesRoutes = require("./routes/heroes.routes");
const draftRoutes = require("./routes/draft.routes");
const castersRoutes = require("./routes/casters.routes");
const overlaySettingsRoutes = require("./routes/overlay-settings.routes");
const scheduleRoutes = require("./routes/schedule.routes");
const standingsRoutes = require("./routes/standings.routes");
const bracketRoutes = require("./routes/bracket.routes");

const app = express();
const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/teams", teamsRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/maps", mapsRoutes);
app.use("/api/heroes", heroesRoutes);
app.use("/api/draft", draftRoutes);
app.use("/api/casters", castersRoutes);
app.use("/api/overlay-settings", overlaySettingsRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/standings", standingsRoutes);
app.use("/api/bracket", bracketRoutes);

app.get("/api/current-overlay-data", async (req, res) => {
  try {
    let [matchRows] = await pool.query(
      `SELECT *
       FROM matches
       WHERE LOWER(status) IN ('live', 'active', 'ongoing')
       ORDER BY COALESCE(queue_order, 999999) ASC, updated_at DESC, id DESC
       LIMIT 1`
    );

    if (!matchRows.length) {
      [matchRows] = await pool.query(
        `SELECT *
         FROM matches
         WHERE series_completed = 1
         ORDER BY series_completed_at DESC, updated_at DESC, id DESC
         LIMIT 1`
      );
    }

    if (!matchRows.length) {
      [matchRows] = await pool.query(
        `SELECT *
         FROM matches
         WHERE LOWER(status) IN ('finished', 'done', 'completed')
         ORDER BY updated_at DESC, id DESC
         LIMIT 1`
      );
    }

    if (!matchRows.length) {
      [matchRows] = await pool.query(
        `SELECT *
         FROM matches
         ORDER BY updated_at DESC, created_at DESC, id DESC
         LIMIT 1`
      );
    }

    const match = matchRows[0] || null;

    let blueTeam = null;
    let redTeam = null;
    let overlayBlueTeam = null;
    let overlayRedTeam = null;
    let game = null;
    let latestFinishedGame = null;
    let map = null;
    let draftActions = [];
    let casters = [];

    if (match) {
      if (match.blue_team_id) {
        const [blueRows] = await pool.query("SELECT * FROM teams WHERE id = ?", [
          match.blue_team_id,
        ]);
        blueTeam = blueRows[0] || null;
      }

      if (match.red_team_id) {
        const [redRows] = await pool.query("SELECT * FROM teams WHERE id = ?", [
          match.red_team_id,
        ]);
        redTeam = redRows[0] || null;
      }

      const [gameRows] = await pool.query(
        "SELECT * FROM games WHERE match_id = ? AND status IN ('setup','drafting','live') ORDER BY game_no ASC LIMIT 1",
        [match.id]
      );
      game = gameRows[0] || null;

      const [finishedGameRows] = await pool.query(
        `SELECT *
         FROM games
         WHERE match_id = ?
           AND LOWER(status) = 'finished'
           AND winner_team_id IS NOT NULL
         ORDER BY finished_at DESC, game_no DESC, updated_at DESC, id DESC
         LIMIT 1`,
        [match.id]
      );
      latestFinishedGame = finishedGameRows[0] || null;

      if (game && game.map_id) {
        const [mapRows] = await pool.query("SELECT * FROM maps WHERE id = ?", [
          game.map_id,
        ]);
        map = mapRows[0] || null;
      }

      if (game) {
        const [draftRows] = await pool.query(
          "SELECT da.*, h.name AS hero_name, h.image_path AS hero_image_path FROM draft_actions da LEFT JOIN heroes h ON da.hero_id = h.id WHERE da.game_id = ? ORDER BY da.action_order ASC",
          [game.id]
        );
        draftActions = draftRows;
      }

      const casterIds = match.caster_ids
        ? match.caster_ids
            .split(",")
            .map((id) => Number(id.trim()))
            .filter(Boolean)
        : [];

      if (casterIds.length) {
        const placeholders = casterIds.map(() => "?").join(",");
        const [casterRows] = await pool.query(
          `SELECT id, name, photo FROM casters WHERE id IN (${placeholders})`,
          casterIds
        );
        casters = casterRows;
      }

      const isEvenGame = Number(game?.game_no || 1) % 2 === 0;
      overlayBlueTeam = isEvenGame ? redTeam : blueTeam;
      overlayRedTeam = isEvenGame ? blueTeam : redTeam;
    }

    res.json({
      match,
      blue_team: blueTeam,
      red_team: redTeam,
      overlay_blue_team_id: overlayBlueTeam?.id || null,
      overlay_red_team_id: overlayRedTeam?.id || null,
      overlay_blue_team: overlayBlueTeam,
      overlay_red_team: overlayRedTeam,
      game,
      latest_finished_game: latestFinishedGame,
      map,
      draft_actions: draftActions,
      casters,
    });
  } catch (error) {
    console.error("Failed to load overlay data", error);
    res.status(500).json({ message: "Failed to load overlay data" });
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("Database connection OK");
  } catch (error) {
    console.error("Database connection failed", error);
  }
});
