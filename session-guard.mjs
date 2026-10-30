/* A monotonic session epoch prevents a late asynchronous reply after vault locking. */
export function createSessionGuard(){
 let epoch=0;
 return Object.freeze({
  start(){return epoch;},
  current(token){return Number.isInteger(token)&&token===epoch;},
  invalidate(){epoch++;return epoch;}
 });
}
