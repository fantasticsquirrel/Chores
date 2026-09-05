import { Text, View } from "react-native";

import { cardStyles } from "../styles/cards";

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
        cardStyles.notice,
        tone === "error" ? cardStyles.noticeError : null,
        tone === "success" ? cardStyles.noticeSuccess : null,
        tone === "warning" ? cardStyles.noticeWarning : null,
        tone === "info" ? cardStyles.noticeInfo : null,
      ]}
    >
      <Text
        style={[
          cardStyles.noticeText,
          tone === "error" ? cardStyles.noticeTextError : null,
          tone === "success" ? cardStyles.noticeTextSuccess : null,
          tone === "warning" ? cardStyles.noticeTextWarning : null,
          tone === "info" ? cardStyles.noticeTextInfo : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}
