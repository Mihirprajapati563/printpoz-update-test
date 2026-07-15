import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getActiveObjectprops } from '../../library/utils/helpers';
import ImageSettingsPanel from './image/ImageSettingsPanel';
import ShapeSettingsPanel from './shape/ShapeSettingsPanel';
import StickerSettingsPanel from './sticker/StickerSettingsPanel';
import { DisplayBetween } from '../../common-components/StyledComponents.jsx';
import { LiaTimesSolid } from "react-icons/lia";
import { setIsActionActive } from "../../store/slices/appAlice.js";

function ObjectSettingAction() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);

  return (
    <div
      className="container sticker-container sticker-container-mob settings-panel-mob p-0"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Heading with inline styles */}
      <DisplayBetween
        className="heading-action-mob d-flex justify-content-between w-100"
        style={{
          padding: '10px 12px',
          background: '#fff',
          flexShrink: 0,
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        <h6 className='mb-0'>Element Properties</h6>
        <LiaTimesSolid
          onClick={() => dispatch(setIsActionActive(false))}
          style={{ cursor: 'pointer' }}
        />
      </DisplayBetween>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'visible',
          minHeight: 0
        }}
      >
        {activeObjectProps && activeObjectProps.type === 'img' && (
          <ImageSettingsPanel />
        )}
        {activeObjectProps && activeObjectProps.type === 'shape' && (
          <ShapeSettingsPanel />
        )}
        {activeObjectProps && activeObjectProps.type === 'sticker' && (
          <StickerSettingsPanel />
        )}
        {!activeObjectProps && (
          <div className="overflow-y-auto h-100 d-flex align-items-center justify-content-center text-muted">
            <p className="small">Select an object to change settings</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ObjectSettingAction
