export default function DocumentCanvas({ allowSend }: { allowSend?: boolean }) {
  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <button>+ Page</button>
        <button>Add Signature</button>
        <button>Add Date</button>
        <button>Upload Document</button>
        {allowSend && <button className="send">Send</button>}
      </div>

      <div className="canvas">
        <p>Start typing your document...</p>
      </div>
    </div>
  );
}
