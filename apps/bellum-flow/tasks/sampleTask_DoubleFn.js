const doubleTaskFn = async (input) => {
    // Randomly fail to simulate a transient error.
    // if (Math.random() < 0.5) {
    //   throw new Error('Random failure in doubleTaskFn');
    // }
    return input * 2;
  };

  module.exports = doubleTaskFn;