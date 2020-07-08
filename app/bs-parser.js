const xmlJs = require('xml-js');
/**
 * Turns parsed costs nodes into something more reasonable
 * @param {Array | Object} rawCosts The xml->js parsed cost node(s)
 * @return {Object} A flattened costs object (Object keys are cost.typeId)
 */
function getCosts(rawCosts) {
  const costs = {};
  let raw;
  if (Array.isArray(rawCosts)) raw = rawCosts;
  else raw = [rawCosts];
  raw.map((cost) => {
    costs[cost.$.typeId] = Object.assign({}, cost.$);
  });
  return costs;
}
/**
 * Extracts roster metadata from xml->js parsed roster
 * @param {Object} parsedXml The xml->js parsed roster
 * @return {Object} An extracted roster metadata object (roster attributes, cost nodes, and costLimit nodes)
 */
function getRosterMeta(parsedXml) {
  const rosterMeta = Object.assign({}, parsedXml.roster.$);
  if (parsedXml.roster.costs) rosterMeta.costs = getCosts(parsedXml.roster.costs.cost);
  if (parsedXml.roster.costLimits) rosterMeta.costLimits = getCosts(parsedXml.roster.costLimits.costLimit);
  return rosterMeta;
}
/**
 * Extracts profiles from the xml->js parsed profile nodes
 * @param {Object | Array} rawProfiles The xml->js parsed profile nodes
 * @param {number} count (default: 1) How many copies of the profile exist on the parent selection
 * @return {Object} A flattened profiles object (Object keys are profile.typeId)
 */
function getProfiles(rawProfiles, count = 1) {
  const profiles = {};
  let raw;
  if (Array.isArray(rawProfiles)) raw = rawProfiles;
  else raw = [rawProfiles];

  for (const profile of raw) {
    const out = Object.assign({}, profile.$);
    out.count = count;
    out.cells = [];
    let characteristics = profile.characteristics.characteristic;
    if (!Array.isArray(characteristics)) characteristics = [characteristics];
    for (const characteristic of characteristics) {
      const cell = Object.assign({}, characteristic.$);
      if (characteristic._) cell.value = characteristic._;
      else cell.value = cell.name;
      out.cells.push(cell);
    }
    if (Object.keys(profiles).includes(out.typeId)) profiles[out.typeId].push(out);
    else profiles[out.typeId] = [out];
  }
  return profiles;
}
/**
 * Merges two tables objects (tables object: key is profile.typeId, value is an array of profiles matching that typeId)
 * @param {Object} a The first table
 * @param {Object} b The second table
 * @return {Object} The merged table
 */
function mergeTables(a, b) {
  // helper for getTables()
  const out = Object.assign({}, a);
  for (const key of Object.keys(b)) {
    if (out[key]) out[key] = out[key].concat(b[key]);
    else out[key] = b[key];
  }
  return out;
}
/**
 * Flattens nested selections from a selection object and extracts tables (collections of profiles/characteristics matching
 * a given profile.typeId). Deduplicates repeated profiles and increments the count on the profile.
 * @param {Object} selection The raw xml->js selection node
 * @return {Object} A flattened tables object (tables object: key is profile.typeId, value is an array of profiles matching that typeId)
 */
function getTables(selection) {
  let tables = {};
  if (selection.selections) {
    let subselections = selection.selections.selection;
    if (!Array.isArray(subselections)) subselections = [subselections];
    for (const subselection of subselections) tables = mergeTables(tables, getTables(subselection));
  }
  if (selection.profiles)
    tables = mergeTables(tables, getProfiles(selection.profiles.profile, Number(selection.$.number)));
  // deduplicate (there's probably a better way)
  const dedupedTables = {};
  for (const key of Object.keys(tables)) {
    const seen = {};
    for (const table of tables[key]) {
      if (!seen[table.id]) {
        seen[table.id] = table;
        if (Array.isArray(dedupedTables[key])) dedupedTables[key].push(table);
        else dedupedTables[key] = [table];
      } else {
        seen[table.id].count++;
      }
    }
  }
  return dedupedTables;
}
/**
 * Extracts categories from the xml -> js processed category nodes
 * @param {Object | Array} rawCategories The raw xml -> js category node
 * @return {Array} An array of category objects (category object has a typeId, a name, and a isPrimaryCategory pseudo-boolean)
 */
function getCategories(rawCategories) {
  const categories = [];
  let raw;
  if (Array.isArray(rawCategories)) raw = rawCategories;
  else raw = [rawCategories];
  raw.map((category) => {
    categories.push(Object.assign({}, category.$));
  });
  return categories;
}
/**
 * Extracts rules from the xml -> js processed rules nodes
 * @param {Object | Array} rawRules The raw xml -> js rules node
 * @return {Array} An array of rules objects
 */
function getRules(rawRules) {
  const rules = [];
  let raw;
  if (Array.isArray(rawRules)) raw = rawRules;
  else raw = [rawRules];
  rules.push(
    raw.map((rule) => {
      const out = Object.assign({}, rule.$);
      out.description = rule.description._;
      return out;
    })
  );
  return rules;
}

/**
 * Extracts units and rules from the xml -> js processed force nodes
 * @param {Object | Array} forceRaw The raw xml -> js force node
 * @return {Object} A force object (which has an array of rules, a units object, and a unitsByCategory object)
 */
function getForce(forceRaw) {
  const force = Object.assign({}, forceRaw.$);
  force.rules = [];
  force.units = {};
  if (forceRaw.costs) force.costs = getCosts(forceRaw.costs.cost);
  if (forceRaw.rules) force.rules = getRules(forceRaw.rules.rule);
  for (const selection of forceRaw.selections.selection) {
    const out = Object.assign({}, selection.$);
    if (selection.selections) {
      out.selections = [];
      let subs = selection.selections.selection;
      if (!Array.isArray(subs)) subs = [subs];
      for (const subSelection of subs) out.selections.push(subSelection.$.name);
    }
    if (selection.costs) out.costs = getCosts(selection.costs.cost);
    if (selection.categories) out.categories = getCategories(selection.categories.category);
    const tables = getTables(selection);
    if (Object.keys(tables).length < 1) {
      // hacky, but it works (Battlescribe has pseudo-rules that are in the file as type "unit" selections with one nested sub-selection)
      if (out.selections) out.description = out.selections[0];
      force.rules.push(out);
      continue;
    } else {
      out.tables = tables;
    }
    // extract column names
    out.tableColumns = {};
    for (const table of Object.values(out.tables)) {
      const t0 = table[0];
      const tableType = {
        name: t0.typeName,
        id: t0.typeId,
      };
      const columns = {};
      for (const column of Object.values(t0.cells)) {
        const copy = Object.assign({}, column);
        delete copy.value; // don't need the actual value
        columns[column.typeId] = copy;
      }
      if (Object.keys(columns).length > 0) tableType.columns = columns;
      if (Object.keys(tableType).length > 0) out.tableColumns[tableType.id] = tableType;
    }
    force.units[out.id] = out;
  }
  // generate unitsByCategory
  force.categoryNames = {};
  force.unitsByCategory = {};
  for (const unit of Object.values(force.units)) {
    const primaryCategory = unit.categories.find((element) => element.primary === 'true');
    const catId = primaryCategory.entryId;
    if (!force.categoryNames[catId]) force.categoryNames[catId] = primaryCategory.name;
    if (force.unitsByCategory[catId]) force.unitsByCategory[catId].push(unit);
    else force.unitsByCategory[catId] = [unit];
  }
  return force;
}

module.exports = (data) => {
  const parsedXml = xmlJs.xml2js(data, {
    compact: true,
    textKey: '_',
    attributesKey: '$',
    commentKey: 'value',
  });
  const roster = getRosterMeta(parsedXml);
  let forces = parsedXml.roster.forces.force;
  if (!Array.isArray(forces)) forces = [forces];
  roster.forces = {};
  for (const force of forces) roster.forces[force.$.id] = getForce(force);
  return roster;
};
