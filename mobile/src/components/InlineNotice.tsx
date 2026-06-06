import { Text, View } from "react-native";

import { styles } from "../styles/layout";

export function InlineNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "error" | "success" | "warning" | "info";
}) {
  return (
    <View
      style={[
        styles.notice,
        tone === "error" ? styles.noticeError : null,
        tone === "success" ? styles.noticeSuccess : null,
        tone === "warning" ? styles.noticeWarning : null,
        tone === "info" ? styles.noticeInfo : null,
      ]}
    >
      <Text
        style={[
          styles.noticeText,
          tone === "error" ? styles.noticeTextError : null,
          tone === "success" ? styles.noticeTextSuccess : null,
          tone === "warning" ? styles.noticeTextWarning : null,
          tone === "info" ? styles.noticeTextInfo : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}
