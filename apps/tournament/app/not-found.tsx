import styles from './not-found.module.css';

/*
 * The 404 (Story 8.6). Next's built-in not-found page paints its own inline `#fff` ground and `#000` text,
 * which the restyle floor refuses (F-1), and a stylesheet cannot reach inline styles. This file renders the
 * same title, the same two headings and the same words in the same order, and no destination the built-in
 * page did not have, on the contract's ground. Presentation only.
 */
export const metadata = {
  title: '404: This page could not be found.',
};

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.code}>404</h1>
        <div>
          <h2 className={styles.message}>This page could not be found.</h2>
        </div>
      </div>
    </div>
  );
}
