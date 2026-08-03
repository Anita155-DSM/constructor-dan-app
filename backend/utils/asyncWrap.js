// Pequeño helper para envolver handlers async y pasar errores a next()
export default function asyncWrap(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
