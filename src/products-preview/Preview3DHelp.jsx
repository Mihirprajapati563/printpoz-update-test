export const Preview3DHelp = () => {

    return (
        <div class="container-fluid">
        <div class="row justify-content-center">
          <div class="col-12 col-md-10 col-lg-8">
            <div class="card shadow-sm mt-3">
              <div class="card-body">
                <h5 class="card-title text-center">How to Use 3D Preview</h5>
                <ul class="list-group list-group-flush">
                  <li class="list-group-item">
                    <strong>Rotate:</strong> Click and drag the mouse to rotate the 3D object.
                  </li>
                  <li class="list-group-item">
                    <strong>Zoom:</strong> Use the mouse scroll wheel or pinch gesture (on touch devices) to zoom in and out.
                  </li>
                  <li class="list-group-item">
                    <strong>Pan:</strong> Hold the right mouse button and drag to pan around the object.
                  </li>
                  <li class="list-group-item">
                    <strong>Reset:</strong> Press <kbd>R</kbd> to reset the view to the default position.
                  </li>
                </ul>
                <div class="text-center mt-3">
                  <button type="button" class="btn btn-primary">Got It</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      

    );
}