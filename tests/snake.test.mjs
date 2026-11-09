import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnakeState, advanceSnake, placeSnakeFood } from '../arcade/snake.js';

test('initial state has room to react, valid food, and does not mutate on a step', () => {
  const start=createSnakeState(()=>0);
  const snapshot=structuredClone(start);
  const next=advanceSnake(start);
  assert.equal(start.snake[0].x,6);
  assert.equal(next.snake[0].x,7);
  assert.equal(next.snake.length,4);
  assert.deepEqual(start,snapshot);
  assert.ok(!start.snake.some(p=>p.x===start.food.x&&p.y===start.food.y));
});
test('a reversal is ignored, perpendicular turns work, and hitting a wall ends the game', () => {
  const start=createSnakeState(()=>0);
  assert.equal(advanceSnake(start,'left').direction,'right');
  assert.equal(advanceSnake(start,'up').snake[0].y,9);
  let state=start;
  for(let i=0;i<14;i++)state=advanceSnake(state,'right');
  assert.equal(state.over,true);
  assert.equal(advanceSnake(state),state);
});
test('food grows the snake and gives points', () => {
  const start={...createSnakeState(()=>0),food:{x:7,y:10}};
  const next=advanceSnake(start,'right',()=>0);
  assert.equal(next.score,10);
  assert.equal(next.snake.length,5);
  assert.ok(!next.snake.some(p=>p.x===next.food.x&&p.y===next.food.y));
});
test('moving into a vacating tail is allowed but moving into the body is not', () => {
  const state={snake:[{x:2,y:2},{x:2,y:3},{x:3,y:3},{x:3,y:2}],direction:'up',food:{x:10,y:10},score:0,over:false,won:false};
  assert.equal(advanceSnake(state,'right').over,false);
  const collision={...state,snake:[{x:2,y:2},{x:2,y:3},{x:3,y:3},{x:3,y:2},{x:4,y:2}]};
  assert.equal(advanceSnake(collision,'right').over,true);
});
test('filling the board wins and food placement never loops forever', () => {
  const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)all.push({x,y});
  assert.equal(placeSnakeFood(all),null);
  const almost={snake:[{x:18,y:19},...all.filter(p=>!(p.x===18&&p.y===19)&&!(p.x===19&&p.y===19))],direction:'right',food:{x:19,y:19},score:3950,over:false,won:false};
  const next=advanceSnake(almost,'right');assert.equal(next.snake.length,400);assert.equal(next.won,true);assert.equal(next.over,false);assert.equal(next.food,null);
});
