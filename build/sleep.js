module.exports = (s) =>
  new Promise((resolve) => {
    setTimeout(resolve, s);
  });
