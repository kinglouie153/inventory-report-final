import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import InventoryApp from "./App";
import Login from "./Login";
import "./index.css";

const Main = () => {
  const [session, setSession] = useState(null);

  return session ? (
    <InventoryApp session={session} />
  ) : (
    <Login onLogin={(user) => setSession(user)} />
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Main />);
