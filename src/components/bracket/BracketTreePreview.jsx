import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const bracketRoundStyle = {
  minWidth: "228px",
  flex: "0 0 228px",
};

const bracketRoundHeaderStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginBottom: "14px",
  padding: "0 2px",
};

const bracketRoundMatchesBaseStyle = {
  display: "flex",
  flexDirection: "column",
};

const bracketMatchCardStyle = {
  position: "relative",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(8, 13, 24, 0.92)",
  borderRadius: "10px",
  overflow: "visible",
};

const bracketMatchTitleStyle = {
  padding: "8px 12px 7px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255, 255, 255, 0.72)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
};

const bracketTeamRowStyle = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) 62px",
  alignItems: "center",
  gap: "8px",
  minHeight: "34px",
  padding: "0 12px",
};

const bracketSeedStyle = {
  fontSize: "12px",
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.55)",
};

const bracketTeamNameStyle = {
  minWidth: 0,
  fontSize: "13px",
  fontWeight: 600,
  color: "#f7f8fb",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const bracketScoreStyle = {
  textAlign: "right",
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.42)",
};

const byeBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "40px",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "rgba(255, 94, 0, 0.16)",
  color: "#ff9b61",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const autoAdvanceBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px 6px",
  borderRadius: "999px",
  background: "rgba(34, 197, 94, 0.12)",
  color: "rgba(134, 239, 172, 0.95)",
  border: "1px solid rgba(34, 197, 94, 0.18)",
  fontSize: "9px",
  fontWeight: 700,
  lineHeight: "1.1",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

function getRoundSpacing(roundIndex, variant) {
  const baseSpacing = variant === "full" ? 24 : 18;
  return Math.pow(2, roundIndex) * baseSpacing;
}

function getRoundPaddingTop(roundIndex, variant) {
  const extraPadding = variant === "full" ? 28 : 20;
  return roundIndex === 0 ? 0 : getRoundSpacing(roundIndex - 1, variant) / 2 + extraPadding;
}

function buildDisplayNoByRef(preview) {
  const displayNoByRef = new Map();

  preview?.rounds?.forEach((round) => {
    round.matches?.forEach((match) => {
      if (match.bracket_match_ref && match.display_match_no) {
        displayNoByRef.set(match.bracket_match_ref, match.display_match_no);
      }
    });
  });

  return displayNoByRef;
}

function resolvePublicMatchLabel(sourceRef, displayNoByRef, fallbackPrefix) {
  if (!sourceRef) {
    return null;
  }

  const displayNo = displayNoByRef.get(sourceRef);
  return displayNo ? `${fallbackPrefix} Match ${displayNo}` : `${fallbackPrefix} ${sourceRef}`;
}

function normalizePlaceholderLabel(label, sourceRef, displayNoByRef, fallbackPrefix) {
  if (typeof label !== "string") {
    return label;
  }

  if (label.startsWith(`${fallbackPrefix} Match `)) {
    return label;
  }

  if (label.startsWith(`${fallbackPrefix} `) || label.startsWith("Winner of ") || label.startsWith("Loser of ")) {
    return resolvePublicMatchLabel(sourceRef, displayNoByRef, fallbackPrefix) || label;
  }

  return label;
}

function getMatchSlotDisplay(match, slotKey) {
  const teamName = match[`team_${slotKey}_name`];
  const seed = match[`seed_${slotKey}`];
  const sourceRef = match[`team_${slotKey}_source_ref`];
  const isBye = String(teamName).toUpperCase() === "BYE";
  const isAutoAdvanced = Boolean(match[`team_${slotKey}_auto_advanced`]);
  const hasActualTeam = Boolean(teamName) && !isBye && !String(teamName).startsWith("Winner of ");

  if (hasActualTeam) {
    return {
      seed: seed ?? "-",
      name: teamName,
      badge: isAutoAdvanced ? "Advance" : null,
      isBye: false,
    };
  }

  if (isAutoAdvanced && match.auto_advanced_team_name) {
    return {
      seed: match.auto_advanced_seed ?? seed ?? "-",
      name: match.auto_advanced_team_name,
      badge: "Advance",
      isBye: false,
    };
  }

  if (sourceRef) {
    return {
      seed: seed ?? "-",
      name: `Winner of ${sourceRef}`,
      badge: null,
      isBye: false,
    };
  }

  if (isBye) {
    return {
      seed: seed ?? "-",
      name: "BYE",
      badge: "BYE",
      isBye: true,
    };
  }

  return {
    seed: seed ?? "-",
    name: teamName || "TBD",
    badge: null,
    isBye: false,
  };
}

function BracketTreePreview({ preview, variant = "controller" }) {
  const treeRef = useRef(null);
  const matchRefs = useRef(new Map());
  const [connectorState, setConnectorState] = useState({ paths: [], width: 0, height: 0 });
  const isFullVariant = variant === "full";
  const displayNoByRef = useMemo(() => buildDisplayNoByRef(preview), [preview]);

  useLayoutEffect(() => {
    if (!preview || !treeRef.current) {
      setConnectorState({ paths: [], width: 0, height: 0 });
      return undefined;
    }

    let frameId = 0;

    const measureConnectors = () => {
      const treeNode = treeRef.current;
      if (!treeNode) {
        return;
      }

      const treeRect = treeNode.getBoundingClientRect();
      const nextPaths = [];

      preview.rounds?.forEach((round) => {
        round.matches
          ?.filter((match) => match.should_display !== false)
          .forEach((match) => {
            const destinationNode = matchRefs.current.get(match.bracket_match_ref);
            if (!destinationNode) {
              return;
            }

            const destinationRect = destinationNode.getBoundingClientRect();
            const destinationLeftX = destinationRect.left - treeRect.left;
            const destinationMidY =
              destinationRect.top + destinationRect.height / 2 - treeRect.top;

            [match.source_a_ref, match.source_b_ref].forEach((sourceRef) => {
              if (!sourceRef) {
                return;
              }

              const sourceNode = matchRefs.current.get(sourceRef);
              if (!sourceNode) {
                return;
              }

              const sourceRect = sourceNode.getBoundingClientRect();
              const sourceRightX = sourceRect.right - treeRect.left;
              const sourceMidY = sourceRect.top + sourceRect.height / 2 - treeRect.top;
              const midX = sourceRightX + (destinationLeftX - sourceRightX) / 2;

              nextPaths.push(
                `M ${sourceRightX} ${sourceMidY} H ${midX} V ${destinationMidY} H ${destinationLeftX}`
              );
            });
          });
      });

      setConnectorState({
        paths: nextPaths,
        width: treeNode.scrollWidth,
        height: treeNode.scrollHeight,
      });
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measureConnectors);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [preview, variant]);

  useEffect(() => {
    if (!preview) {
      return undefined;
    }

    let frameId = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });

    return () => cancelAnimationFrame(frameId);
  }, [preview, variant]);

  if (!preview) {
    return null;
  }

  return (
    <div className={`bracket-tree-shell bracket-tree-shell-${variant} bracket-tree-wide`} ref={treeRef}>
      <svg
        className="bracket-connector-overlay"
        width={connectorState.width}
        height={connectorState.height}
        viewBox={`0 0 ${connectorState.width || 1} ${connectorState.height || 1}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {connectorState.paths.map((path, index) => (
          <path key={`${index}-${path}`} d={path} className="bracket-connector-path" />
        ))}
      </svg>

      <div className="bracket-tree">
        {preview.rounds?.map((round, roundIndex) => {
          const visibleMatches =
            round.matches?.filter((match) => match.should_display !== false) || [];

          return (
            <div
              key={round.round_no}
              className="bracket-round"
              style={{
                ...bracketRoundStyle,
                minWidth: isFullVariant ? "256px" : bracketRoundStyle.minWidth,
                flex: isFullVariant ? "0 0 256px" : bracketRoundStyle.flex,
              }}
            >
              <div className="bracket-round-header" style={bracketRoundHeaderStyle}>
                <strong>{round.title}</strong>
                <div className="helper-text">{round.mode}</div>
                <div className="helper-text">
                  {visibleMatches.length || 0} match
                  {visibleMatches.length === 1 ? "" : "es"}
                </div>
              </div>

              <div
                className="bracket-round-matches"
                style={{
                  ...bracketRoundMatchesBaseStyle,
                  gap: `${getRoundSpacing(roundIndex, variant)}px`,
                  paddingTop: `${getRoundPaddingTop(roundIndex, variant)}px`,
                }}
              >
                {visibleMatches.map((match) => {
                  const teamA = getMatchSlotDisplay(match, "a");
                  const teamB = getMatchSlotDisplay(match, "b");
                  const displayTeamAName = normalizePlaceholderLabel(
                    teamA.name,
                    match.team_a_source_ref,
                    displayNoByRef,
                    "Winner of"
                  );
                  const displayTeamBName = normalizePlaceholderLabel(
                    teamB.name,
                    match.team_b_source_ref,
                    displayNoByRef,
                    "Winner of"
                  );

                  return (
                    <div
                      key={`${round.round_no}-${match.bracket_match_no}`}
                      className="bracket-match-card"
                      style={bracketMatchCardStyle}
                      ref={(node) => {
                        if (node) {
                          matchRefs.current.set(match.bracket_match_ref, node);
                        } else {
                          matchRefs.current.delete(match.bracket_match_ref);
                        }
                      }}
                      data-match-ref={match.bracket_match_ref}
                    >
                      <div style={bracketMatchTitleStyle}>
                        <span>{`MATCH ${match.display_match_no ?? match.bracket_match_no}`}</span>
                      </div>
                      <div
                        className="bracket-team-row"
                        style={{
                          ...bracketTeamRowStyle,
                          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <span style={bracketSeedStyle}>{teamA.seed}</span>
                        <span style={bracketTeamNameStyle}>{displayTeamAName}</span>
                        <span style={bracketScoreStyle}>
                          {teamA.badge ? (
                            <span style={teamA.isBye ? byeBadgeStyle : autoAdvanceBadgeStyle}>
                              {teamA.badge}
                            </span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </div>
                      <div className="bracket-team-row" style={bracketTeamRowStyle}>
                        <span style={bracketSeedStyle}>{teamB.seed}</span>
                        <span style={bracketTeamNameStyle}>{displayTeamBName}</span>
                        <span style={bracketScoreStyle}>
                          {teamB.badge ? (
                            <span style={teamB.isBye ? byeBadgeStyle : autoAdvanceBadgeStyle}>
                              {teamB.badge}
                            </span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {preview.third_place_match ? (
        <section
          className={`modern-card bracket-third-place-card bracket-third-place-panel bracket-third-place-panel-${variant}`}
        >
          <div className="panel-header">
            <h2>3rd Place Match</h2>
          </div>
          <div className="bracket-match-card">
            <div className="bracket-match-meta">{preview.third_place_match.mode}</div>
            <div className="bracket-team-row bracket-third-place-row bracket-third-place-row-top">
              <span className="bracket-seed-label">-</span>
              <span className="bracket-team-label">{preview.third_place_match.team_a_name}</span>
              <span className="bracket-score-label">-</span>
            </div>
            <div className="bracket-team-row bracket-third-place-row">
              <span className="bracket-seed-label">-</span>
              <span className="bracket-team-label">{preview.third_place_match.team_b_name}</span>
              <span className="bracket-score-label">-</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default BracketTreePreview;
