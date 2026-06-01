import { createTheme } from "@mui/material/styles";

// Dark-only theme. `primary.main` is the app accent and the single source of
// truth for the route line and map marker colors (T6a/T10).
export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#38bdf8" },
  },
});
