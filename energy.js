// Net activity energy per kg, excluding resting energy. Activity is user-selected.
// MET assumptions: moderate level walking (3.8), general jogging (7.5).
export function energyPerKg(steps,cadence,activity='walking'){
  if(!Number.isFinite(steps) || steps<=0 || !Number.isFinite(cadence) || cadence<=0)return 0;
  const met=activity==='jogging'?7.5:3.8;
  return (met-1)*3.5/200*(steps/cadence);
}
