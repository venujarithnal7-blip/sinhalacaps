export default function CaptionFrame({ text, styles }) {
  return (
    <div
      style={{
        width: "1080px",
        height: "1920px",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        paddingBottom: "200px",
        background: "transparent",
      }}
    >
      <div
        style={{
          fontSize: styles.fontSize,
          fontWeight: 800,
          color: styles.fontColor,
          fontFamily: styles.fontFamily,
          background: styles.showBackground
            ? styles.bgColor
            : "transparent",
          padding: "20px 40px",
          borderRadius: "20px",
        }}
      >
        {text}
      </div>
    </div>
  );
}