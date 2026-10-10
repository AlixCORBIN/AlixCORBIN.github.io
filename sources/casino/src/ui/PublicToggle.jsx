import React from "react";

// Pastille hôte : rendre la salle visible (publique) ou non dans le hub
export function PublicToggle({ ctrl }) {
  if (ctrl.role !== "host") return null;
  if (!ctrl.online) {
    return ctrl.offlineFallback ? <div className="pubtoggle off">Hors ligne · partie locale</div> : null;
  }
  return (
    <button className={`pubtoggle ${ctrl.isPublic ? "on" : ""}`} onClick={() => ctrl.setPublic(!ctrl.isPublic)}
      title={ctrl.isPublic ? "Visible dans la liste des salles du Casino" : "Seuls ceux qui ont le code peuvent rejoindre"}>
      <i />{ctrl.isPublic ? "Salle publique" : "Salle privée"}
    </button>
  );
}
