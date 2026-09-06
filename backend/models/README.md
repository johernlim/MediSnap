Place the selected pill-specific model export here as `yolo26_pills.pt`.

Source: https://universe.roboflow.com/sandy-kyogt/pills-kxe6h-afvos/model/12

Open version 12 and use **Download Weights** if your account and the owner's
permissions allow it. This downloads trained weights, not a dataset. Do not train
or download a generic YOLO checkpoint. Ask the model owner for the exact export if
download is unavailable. Roboflow documents account/plan restrictions at
https://docs.roboflow.com/deploy/download-roboflow-model-weights.

Set `YOLO_MODEL_PATH` in `backend/.env` to an absolute path or a path relative to
`backend/`. The adapter uses Ultralytics and accepts compatible `.pt` or `.onnx`
exports (ONNX requires `pip install onnxruntime`). Export metadata must preserve
class names. Other Ultralytics supported export directories may require their
runtime dependencies. Incompatible exports produce a controlled unavailable
state; a differently formatted architecture needs its own adapter, never renaming
the file to pretend compatibility. The exact export type and model architecture
could not be verified without access to this version's weights.

Only load weights from a trusted model owner. No model weights are redistributed
by this repository. Review the model/dataset owner's license and Ultralytics terms.
