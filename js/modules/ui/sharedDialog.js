import { UPM_UI_PREFIX, ICONS } from '../config.js';
import { createIcon } from '../utils.js';

export const sharedConfirmDialog = {
    dialog: null,
    create: function() {
        this.dialog = document.createElement('div');
        this.dialog.id = `${UPM_UI_PREFIX}-confirm-dialog-shared`;
        this.dialog.className = `${UPM_UI_PREFIX}-modal-overlay`;
        this.dialog.style.display = 'none';

        const box = document.createElement('div');
        box.className = `${UPM_UI_PREFIX}-dialog-box`;

        const msgP = document.createElement('p');
        msgP.id = `${UPM_UI_PREFIX}-confirm-msg-shared`;

        const btnsDiv = document.createElement('div');
        btnsDiv.className = `${UPM_UI_PREFIX}-dialog-buttons`;

        const yesBtn = document.createElement('button');
        yesBtn.id = `${UPM_UI_PREFIX}-confirm-yes-shared`;
        yesBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-danger`;
        yesBtn.appendChild(createIcon(ICONS.confirm));
        yesBtn.appendChild(document.createTextNode(' Confirm'));

        const noBtn = document.createElement('button');
        noBtn.id = `${UPM_UI_PREFIX}-confirm-no-shared`;
        noBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-secondary`;
        noBtn.appendChild(createIcon(ICONS.cancel));
        noBtn.appendChild(document.createTextNode(' Cancel'));

        btnsDiv.appendChild(yesBtn);
        btnsDiv.appendChild(noBtn);
        box.appendChild(msgP);
        box.appendChild(btnsDiv);
        this.dialog.appendChild(box);
        document.body.appendChild(this.dialog);
    },
    show: function(message, onConfirmCallback) {
        if (!this.dialog) this.create();

        this.dialog.querySelector(`#${UPM_UI_PREFIX}-confirm-msg-shared`).textContent = message;
        this.dialog.style.display = 'flex';

        const yesBtn = this.dialog.querySelector(`#${UPM_UI_PREFIX}-confirm-yes-shared`);
        const noBtn = this.dialog.querySelector(`#${UPM_UI_PREFIX}-confirm-no-shared`);

        // Clone and replace to remove old event listeners
        const newYes = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYes, yesBtn);
        const newNo = noBtn.cloneNode(true);
        noBtn.parentNode.replaceChild(newNo, noBtn);

        newYes.onclick = () => {
            this.dialog.style.display = 'none';
            onConfirmCallback();
        };
        newNo.onclick = () => {
            this.dialog.style.display = 'none';
        };
    }
};