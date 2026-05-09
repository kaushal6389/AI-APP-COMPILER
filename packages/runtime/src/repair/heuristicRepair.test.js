require('ts-node/register/transpile-only');
const assert = require('assert');
const { applyHeuristicRepairs } = require('./heuristicRepair.ts');

const makeModel = (fields, relations) => ({ fields: fields.slice(), relations: relations.slice() });

const run = () => {
  const modelMap = {
    Task: makeModel(
      [{ name: 'id', type: 'String', isUnique: true, isOptional: false, isList: false }],
      [{ type: 'N:1', target: 'User', foreignKey: 'userId', side: 'many', name: 'task_user_rel' }]
    ),
    User: makeModel(
      [{ name: 'id', type: 'String', isUnique: true, isOptional: false, isList: false }],
      []
    )
  };

  const log = applyHeuristicRepairs(modelMap, { aggressive: true });
  assert(Array.isArray(log), 'repair log should be an array');

  const taskHasUserId = modelMap.Task.fields.some((f) => f.name === 'userId');
  assert(taskHasUserId, 'missing FK field should be injected on source model');

  const reciprocal = modelMap.User.relations.find((r) => r.target === 'Task');
  assert(reciprocal, 'reciprocal relation should be added on target model');
  assert.strictEqual(reciprocal.name, 'task_user_rel', 'reciprocal relation should keep canonical name');

  const selfMap = {
    Node: makeModel(
      [{ name: 'id', type: 'String', isUnique: true, isOptional: false, isList: false }],
      [{ type: 'N:1', target: 'Node', side: 'many' }]
    )
  };

  const selfLog = applyHeuristicRepairs(selfMap, { aggressive: true });
  assert(selfMap.Node.fields.some((f) => f.name === 'nodeId'), 'self relation should inject self fk');
  assert(selfLog.some((x) => x.type === 'self-relation-fk'), 'self relation repair should be logged');

  console.log('heuristicRepair tests OK');
};

run();
