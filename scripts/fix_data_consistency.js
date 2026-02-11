
const fs = require('fs');
const path = require('path');

const unitMapPath = path.join(__dirname, '../data/unit_map.json');
const templatesPath = path.join(__dirname, '../data/templates.json');

const unitMap = JSON.parse(fs.readFileSync(unitMapPath, 'utf-8'));
const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));

// Mapping from old invalid IDs to new valid IDs
const ID_MAPPING = {
    'u1': 'm1_shiki',
    'u2': 'm1_shiki',
    'u3': 'm1_shiki',
    'u4': 'm1_shiki',
    'u5': 'm1_shiki',
    'u6': 'm1_shiki',
    'u7': 'm1_shiki',
    'u8': 'm1_2ji_func'
};

// 1. Update Templates with correct Unit IDs
templates.forEach(t => {
    if (ID_MAPPING[t.unit_id]) {
        t.unit_id = ID_MAPPING[t.unit_id];
    }
});

// 2. Populate UnitMap templates
// Reset all templates first
Object.values(unitMap.units).forEach(u => {
    u.templates = { L1: [], L2: [], L3: [] };
});

// Distribute templates
templates.forEach(t => {
    const unit = unitMap.units[t.unit_id];
    if (unit) {
        if (!unit.templates[t.difficulty]) {
            unit.templates[t.difficulty] = [];
        }
        unit.templates[t.difficulty].push(t.id);
    } else {
        console.warn(`Warning: Template ${t.id} has unknown unit_id ${t.unit_id}`);
    }
});

// 3. Write back
fs.writeFileSync(unitMapPath, JSON.stringify(unitMap, null, 2));
fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));

console.log('Successfully fixed data inconsistencies.');
console.log('Updated', templatesPath);
console.log('Updated', unitMapPath);
