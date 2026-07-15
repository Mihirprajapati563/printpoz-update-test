import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';

function Photo(props) {
    const dispatch = useDispatch();
    const {item, zoomRatio} = props;
    return (
        <>
        <div key={item.id + 'img'}
        class={`noPointer position-absolute inset-0 `}
        style={{opacity: item.opacity,
         backgroundImage: `url(${item.url})`,
          backgroundSize: item.adjustment === 'cover' || item.adjustment === 'burn_effect' ? 'cover' : item.adjustment === 'contain' ? 'contain' : item.adjustment === 'stretch' ? '100% 100%' : '' ,
          backgroundRepeat: item.adjustment === 'tile' ? 'repeat' : 'no-repeat',
           backgroundPosition: 'center center', borderRadius: item.borderRadius + 'px', filter: `brightness(${item.brightness}%) contrast(${item.contrast}%) saturate(${item.saturation}%)` }}>
        </div>

         {/* {item.type === 'img' && item.orientation !== 0 && <imageOrientation 
            url={item.url} orientation={item.orientation} />} */}
       </>
    
    );
}

export default Photo;