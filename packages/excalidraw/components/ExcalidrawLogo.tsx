import "./ExcalidrawLogo.scss";

const LogoText = () => (
  <img
    src="metazapp -svg -text.svg" // Replace with the actual path to your SVG text file
    alt="Excalidraw Logo Text"
    className="ExcalidrawLogo-text" // You might need to adjust styles in ExcalidrawLogo.scss if using <img>
  />
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean; // This prop will now effectively always be true if you want to see the logo
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "normal",
  withText, // If withText is false, nothing will be rendered.
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      {withText && <LogoText />}
    </div>
  );
};
