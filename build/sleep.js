export default (s) =>
  new Promise((resolve) => {
    setTimeout(resolve, s);
  });
