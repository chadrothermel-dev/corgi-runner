export const STORAGE_KEY = 'corgi_runner_highscore';

export const Storage = {
  getHighScore() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val === null || val === undefined) {
        return 0;
      }
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 0) {
        return 0;
      }
      return parsed;
    } catch (e) {
      return 0;
    }
  },

  saveHighScore(score) {
    try {
      const current = this.getHighScore();
      const numScore = Math.floor(Number(score) || 0);
      if (numScore > current) {
        localStorage.setItem(STORAGE_KEY, String(numScore));
        return numScore;
      }
      return current;
    } catch (e) {
      return Math.floor(Number(score) || 0);
    }
  },

  resetHighScore() {
    try {
      localStorage.setItem(STORAGE_KEY, '0');
    } catch (e) {
      // ignore
    }
  }
};
