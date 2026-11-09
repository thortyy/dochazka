import assert from 'node:assert/strict';
import { makeBricks, circleHitsRect, bounceFromPaddle, clampPaddle } from '../arcade/breaker.js';
for (const level of [1,2,3]) {
 const bricks=makeBricks(level);assert.equal(bricks.length,(3+level)*8);
 assert.ok(bricks.every(b=>b.x>=0&&b.x+b.w<=600&&b.y>=0&&b.y+b.h<300&&b.hp>=1));
 assert.ok(bricks.every((b,i)=>bricks.every((other,j)=>i===j||b.x+b.w<=other.x||other.x+other.w<=b.x||b.y+b.h<=other.y||other.y+other.h<=b.y)));
}
assert.ok(makeBricks(3).some(b=>b.hp===2));
const rect={x:20,y:20,w:40,h:10};
assert.equal(circleHitsRect({x:30,y:15,r:5},rect),true);
assert.equal(circleHitsRect({x:14,y:15,r:5},rect),false);
assert.equal(circleHitsRect({x:20,y:20,r:1},rect),true);
assert.equal(circleHitsRect({x:65,y:25,r:5},rect),true);
const paddle={x:100,w:100};
for (const x of [100,125,150,175,200]) {
 const ball=bounceFromPaddle({x,y:340,r:7,vx:0,vy:300},paddle,300);
 assert.ok(ball.vy<0);assert.ok(Math.abs(Math.hypot(ball.vx,ball.vy)-300)<.000001);assert.ok(ball.y+ball.r<344);
 if(x<150)assert.ok(ball.vx<0);else if(x>150)assert.ok(ball.vx>0);else assert.equal(ball.vx,0);
}
assert.equal(clampPaddle(-100,100),10);assert.equal(clampPaddle(1000,100),490);assert.equal(clampPaddle(120,100),120);
console.log('PASS breaker: three non-overlapping level layouts, collisions, paddle bounce angle/speed, paddle boundaries.');
