import { useGameStore } from "../../../../game/hud/state";
import styles from "./StreamChat.module.css";

// Les derniers messages du chat du direct. Purement décoratif : il ne porte
// jamais une information nécessaire, et se masque dans les options.
// see: docs/decisions/0038-simulation-du-direct.md
export function StreamChat() {
  const chat = useGameStore((s) => s.chat);
  if (chat.length === 0) return null;

  return (
    <ul className={styles.chat} aria-hidden="true">
      {chat.map((message) => (
        <li key={message.id} className={styles.line} data-kind={message.kind}>
          <span className={styles.pseudo}>{message.pseudo}</span> {message.text}
        </li>
      ))}
    </ul>
  );
}
