import Table from "react-bootstrap/Table";
import styled from "styled-components";

const StyledTable = styled(Table)`
  border-top: 0px solid #fff;
  thead th {
    border: none;
    font-family: Roboto;
    font-size: 18px;
    font-weight: 500;
    line-height: 21.09px;
    text-align: left;
  }
  .status,
  .link {
    color: #66b49d;
  }
  .link {
    text-decoration: none;
  }
  tbody td {
    vertical-align: middle;
    border-right-color: #fff;
  }
  tbody td:last-child {
    border-right-color: inherit !important;
  }
`;

export const DynamicTable = ({ headers, rows, renderRow }) => {
  return (
    <StyledTable bordered hover>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index} style={header.style}>
              {header.text}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map((row, rowIndex) => renderRow(row, rowIndex))}</tbody>
    </StyledTable>
  );
};
